export type ExampleConfig = {
  id: string;
  label: string;
  description: string;
  format: string;
  source: string;
};

export const examples: ExampleConfig[] = [
  {
    id: "bad-serverless",
    label: "Risky serverless.yml",
    description: "Missing DLQ, redrive, alarms — common happy-path stack",
    format: "Serverless Framework",
    source: `service: orders-api

provider:
  name: aws
  runtime: nodejs20.x

functions:
  processOrder:
    handler: src/process.handler
    events:
      - sqs:
          arn: !GetAtt OrdersQueue.Arn
          batchSize: 10
  publicApi:
    handler: src/api.handler
    events:
      - httpApi:
          path: /orders
          method: post

resources:
  Resources:
    OrdersQueue:
      Type: AWS::SQS::Queue
      Properties:
        VisibilityTimeout: 5
`,
  },
  {
    id: "good-serverless",
    label: "Healthy serverless.yml",
    description: "DLQ, redrive, timeouts, tracing, and an error alarm",
    format: "Serverless Framework",
    source: `service: orders-api

provider:
  name: aws
  runtime: nodejs20.x
  tracing:
    lambda: true
  logs:
    lambda:
      logFormat: JSON

functions:
  processOrder:
    handler: src/process.handler
    timeout: 30
    reservedConcurrency: 10
    destinations:
      onFailure: !GetAtt OrdersDlq.Arn
    environment:
      POWERTOOLS_SERVICE_NAME: orders
    events:
      - sqs:
          arn: !GetAtt OrdersQueue.Arn
          batchSize: 10
          maximumRetryAttempts: 2

resources:
  Resources:
    OrdersQueue:
      Type: AWS::SQS::Queue
      Properties:
        VisibilityTimeout: 180
        RedrivePolicy:
          deadLetterTargetArn: !GetAtt OrdersDlq.Arn
          maxReceiveCount: 3
    OrdersDlq:
      Type: AWS::SQS::Queue
    ProcessOrderErrors:
      Type: AWS::CloudWatch::Alarm
      Properties:
        AlarmDescription: Lambda errors
        Namespace: AWS/Lambda
        MetricName: Errors
        Statistic: Sum
        Period: 60
        EvaluationPeriods: 1
        Threshold: 1
        ComparisonOperator: GreaterThanOrEqualToThreshold
`,
  },
  {
    id: "bad-sam",
    label: "Risky SAM template",
    description: "Async function without failure destinations",
    format: "SAM",
    source: `AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31

Resources:
  ProcessOrder:
    Type: AWS::Serverless::Function
    Properties:
      Handler: app.handler
      Runtime: nodejs20.x
      Timeout: 30
      Events:
        OrderQueue:
          Type: SQS
          Properties:
            Queue: !GetAtt OrdersQueue.Arn
            BatchSize: 10

  OrdersQueue:
    Type: AWS::SQS::Queue
    Properties:
      VisibilityTimeout: 10
`,
  },
];
