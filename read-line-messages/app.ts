import { SQSRecord } from 'aws-lambda';

type StepFunctionsReturn = {
  replyToken: string;
  receiptHandle: string;
}[];

export const lambdaHandler = async (records: SQSRecord[]): Promise<StepFunctionsReturn> => {
  return records.map((record) => {
    const body = JSON.parse(record.body);
    return {
      replyToken: body.replyToken,
      receiptHandle: record.receiptHandle,
    };
  });
};
