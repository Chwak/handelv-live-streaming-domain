import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';

export interface TrackViewerLambdaConstructProps {
  environment: string;
  regionCode: string;
  streamViewersTable: dynamodb.ITable;
  liveStreamsTable: dynamodb.ITable;
  removalPolicy?: cdk.RemovalPolicy;
}

export class TrackViewerLambdaConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: TrackViewerLambdaConstructProps) {
    super(scope, id);

    const role = new iam.Role(this, 'TrackViewerLambdaRole', {
      roleName: `${props.environment}-${props.regionCode}-live-streaming-domain-track-viewer-lambda-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for Track Viewer Lambda',
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
                `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${props.environment}-${props.regionCode}-live-streaming-domain-track-viewer-lambda*`,
              ],
            }),
          ],
        }),
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem'],
              resources: [
                props.streamViewersTable.tableArn,
                props.liveStreamsTable.tableArn,
              ],
            }),
          ],
        }),
      },
    });

    const logGroup = new logs.LogGroup(this, 'TrackViewerLogGroup', {
      logGroupName: `/aws/lambda/${props.environment}-${props.regionCode}-live-streaming-domain-track-viewer-lambda`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.DESTROY,
    });

    const lambdaCodePath = path.join(__dirname, '../../../../functions/lambda/streaming/track-viewer');
    this.function = new lambda.Function(this, 'TrackViewerFunction', {
      functionName: `${props.environment}-${props.regionCode}-live-streaming-domain-track-viewer-lambda`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'track-viewer-lambda.handler',
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
        LIVE_STREAMS_TABLE_NAME: props.liveStreamsTable.tableName,
        LOG_LEVEL: props.environment === 'prod' ? 'ERROR' : 'INFO',
      },
      description: 'Track viewer join/leave events for a stream',
    });

    props.streamViewersTable.grantReadWriteData(this.function);
    props.liveStreamsTable.grantReadWriteData(this.function);


    if (props.removalPolicy) {
      this.function.applyRemovalPolicy(props.removalPolicy);
    }
  }
}
