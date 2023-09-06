import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler } from 'aws-lambda';
import { createHmac } from 'crypto';

type RequestBody = {
  destination: string;
  events: MessageEvent[];
};

type Event = {
  type: string;
  mode: string;
  timestamp: number;
  source?: {
    type: string;
    userId: string;
  };
  webhookEventId: string;
  deliveryContext: {
    isRedelivery: boolean;
  };
};

type Message = {
  id: string;
  type: string;
};

type TextMessage = {
  text: string;
} & Message;

type MessageEvent = {
  id: string;
  replyToken: string;
  message: TextMessage;
} & Event;

export const lambdaHandler: Handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const ssm = new SSMClient({ region: 'ap-northeast-1' });
    const getParameterCommand = new GetParameterCommand({ Name: '/aoyama/line/channel-secret', WithDecryption: true });
    const store = await ssm.send(getParameterCommand);
    const channelSecret = store.Parameter?.Value;
    if (!channelSecret) throw new Error('can not get channel secret');

    // リクエストの検証
    const expectedSignature = event.headers['X-Line-Signature'] || event.headers['x-line-signature'];
    const body = event.body || '{}';
    const actualSignature = createHmac('SHA256', channelSecret).update(body).digest('base64');
    if (expectedSignature !== actualSignature) {
      throw new Error('invalid');
    }

    const { events } = JSON.parse(body) as RequestBody;
    const messageEvents = events.filter((event) => event.type === 'message');

    // SQS送信
    const replyTokens = messageEvents.map((event) => {
      return event.replyToken;
    });
    const sqs = new SQSClient({ region: 'ap-northeast-1' });
    const command = new SendMessageBatchCommand({
      QueueUrl: process.env.QUEUE_URL,
      Entries: replyTokens.map((replyToken, index) => ({
        Id: index.toString(),
        MessageBody: JSON.stringify({ replyToken }),
      })),
    });
    await sqs.send(command).catch(console.log);

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'ok',
      }),
    };
  } catch (err) {
    console.log(err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: 'failed',
      }),
    };
  }
};
