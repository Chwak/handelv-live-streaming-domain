import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';

export interface EndStreamLambdaConstructProps {
  environment: string;
  regionCode: string;
  liveStreamsTable: dynamodb.ITable;
  removalPolicy?: cdk.RemovalPolicy;
}

export class EndStreamLambdaConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: EndStreamLambdaConstructProps) {
    super(scope, id);

    const role = new iam.Role(this, 'EndStreamLambdaRole', {
      roleName: `${props.environment}-${props.regionCode}-live-streaming-domain-end-stream-lambda-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for End Stream Lambda',
      inlinePolicies: {
        CloudWatchLogsAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: [
                `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${props.environment}-${props.regionCode}-live-streaming-domain-end-stream-lambda*`,
              ],
            }),
          ],
        }),
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
              resources: [
                props.liveStreamsTable.tableArn,
                `${props.liveStreamsTable.tableArn}/index/*`,
              ],
            }),
          ],
        }),
      },
    });

    const logGroup = new logs.LogGroup(this, 'EndStreamLogGroup', {
      logGroupName: `/aws/lambda/${props.environment}-${props.regionCode}-live-streaming-domain-end-stream-lambda`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.DESTROY,
    });

    const lambdaCodePath = path.join(__dirname, '../../../../functions/lambda/streaming/end-stream');
    this.function = new lambda.Function(this, 'EndStreamFunction', {
      functionName: `${props.environment}-${props.regionCode}-live-streaming-domain-end-stream-lambda`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'end-stream-lambda.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      role,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.DISABLED,
      logGroup,
      environment: {
        ENVIRONMENT: props.environment,
        REGION_CODE: props.regionCode,
        LIVE_STREAMS_TABLE_NAME: props.liveStreamsTable.tableName,
        LOG_LEVEL: props.environment === 'prod' ? 'ERROR' : 'INFO',
      },
      description: 'End a live stream',
    });

    props.liveStreamsTable.grantReadWriteData(this.function);


    if (props.removalPolicy) {
      this.function.applyRemovalPolicy(props.removalPolicy);
    }
  }
}
