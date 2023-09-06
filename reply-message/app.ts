import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

type StepFunctionsEvent = {
  replyToken: string;
  receiptHandle: string;
};

export const lambdaHandler = async (event: StepFunctionsEvent): Promise<string> => {
  try {
    const client = new SSMClient({ region: 'ap-northeast-1' });
    const command = new GetParameterCommand({ Name: '/aoyama/line/access-token', WithDecryption: true });
    const store = await client.send(command);
    const accessToken = store.Parameter?.Value;
    if (!accessToken) throw new Error('can not get access token');

    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        replyToken: event.replyToken,
        messages: [
          {
            type: 'text',
            text: 'Hello!',
          },
        ],
      }),
    });

    return event.receiptHandle;
  } catch (err) {
    console.log(err);
    return 'failed';
  }
};
