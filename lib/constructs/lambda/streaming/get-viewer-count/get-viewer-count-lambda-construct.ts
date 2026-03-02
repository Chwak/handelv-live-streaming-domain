import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';

export interface GetViewerCountLambdaConstructProps {
  environment: string;
  regionCode: string;
  streamViewersTable: dynamodb.ITable;
  removalPolicy?: cdk.RemovalPolicy;
}

export class GetViewerCountLambdaConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: GetViewerCountLambdaConstructProps) {
    super(scope, id);

    const role = new iam.Role(this, 'GetViewerCountLambdaRole', {
      roleName: `${props.environment}-${props.regionCode}-live-streaming-domain-get-viewer-count-lambda-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for Get Viewer Count Lambda',
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
                `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${props.environment}-${props.regionCode}-live-streaming-domain-get-viewer-count-lambda*`,
              ],
            }),
          ],
        }),
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['dynamodb:Query'],
              resources: [props.streamViewersTable.tableArn],
            }),
          ],
        }),
      },
    });

    const logGroup = new logs.LogGroup(this, 'GetViewerCountLogGroup', {
      logGroupName: `/aws/lambda/${props.environment}-${props.regionCode}-live-streaming-domain-get-viewer-count-lambda`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.DESTROY,
    });

    const lambdaCodePath = path.join(__dirname, '../../../../functions/lambda/streaming/get-viewer-count');
    this.function = new lambda.Function(this, 'GetViewerCountFunction', {
      functionName: `${props.environment}-${props.regionCode}-live-streaming-domain-get-viewer-count-lambda`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'get-viewer-count-lambda.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      role,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.DISABLED,
      logGroup,
      environment: {
        ENVIRONMENT: props.environment,
        REGION_CODE: props.regionCode,
        STREAM_VIEWERS_TABLE_NAME: props.streamViewersTable.tableName,
        LOG_LEVEL: props.environment === 'prod' ? 'ERROR' : 'INFO',
      },
      description: 'Get the current viewer count for a stream',
    });

    props.streamViewersTable.grantReadData(this.function);


    if (props.removalPolicy) {
      this.function.applyRemovalPolicy(props.removalPolicy);
    }
  }
}
