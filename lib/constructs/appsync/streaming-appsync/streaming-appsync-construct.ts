import * as cdk from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';

export interface StreamingAppSyncConstructProps {
  environment: string;
  regionCode: string;
}

export class StreamingAppSyncConstruct extends Construct {
  public readonly api: appsync.GraphqlApi;
  public readonly apiUrl: string;
  public readonly apiId: string;

  constructor(scope: Construct, id: string, props: StreamingAppSyncConstructProps) {
    super(scope, id);

    const userPoolId = ssm.StringParameter.fromStringParameterName(
      this,
      'UserPoolId',
      `/${props.environment}/auth-essentials/cognito/user-pool-id`
    ).stringValue;

    const userPool = cognito.UserPool.fromUserPoolId(
      this,
      'ImportedUserPool',
      userPoolId
    );

    // Create IAM role for AppSync to write logs
    const apiLogsRole = new iam.Role(this, 'ApiLogsRole', {
      roleName: `${props.environment}-${props.regionCode}-live-streaming-domain-appsync-logs-role`,
      assumedBy: new iam.ServicePrincipal('appsync.amazonaws.com'),
      description: 'IAM role for Live Streaming AppSync API CloudWatch Logs',
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
                `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/appsync/apis/*`,
              ],
            }),
          ],
        }),
      },
    });

    this.api = new appsync.GraphqlApi(this, 'StreamingAppSyncApi', {
      name: `${props.environment}-${props.regionCode}-live-streaming-domain-appsync`,
      definition: appsync.Definition.fromFile(
        path.join(__dirname, 'schema.graphql')
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: userPool,
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.IAM,
          },
        ],
      },
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.INFO,
        excludeVerboseContent: true,
        role: apiLogsRole,
      },
      xrayEnabled: false,
    });

    // Create CloudWatch Log Group for AppSync with manual retention
    // AppSync creates log groups with pattern: /aws/appsync/apis/{apiId}
    // The log group will be created after the API (since it uses apiId), and AppSync will use it if it exists
    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/aws/appsync/apis/${this.api.apiId}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.apiUrl = this.api.graphqlUrl;
    this.apiId = this.api.apiId;

    new ssm.StringParameter(this, 'StreamingAppSyncApiUrlParameter', {
      parameterName: `/${props.environment}/live-streaming-domain/appsync/api-url`,
      stringValue: this.apiUrl,
      description: 'Live Streaming Domain AppSync GraphQL API URL',
    });

    new ssm.StringParameter(this, 'StreamingAppSyncApiIdParameter', {
      parameterName: `/${props.environment}/live-streaming-domain/appsync/api-id`,
      stringValue: this.apiId,
      description: 'Live Streaming Domain AppSync GraphQL API ID',
    });

    new cdk.CfnOutput(this, 'StreamingAppSyncApiUrl', {
      value: this.apiUrl,
      description: 'Live Streaming Domain AppSync GraphQL API URL',
      exportName: `${props.environment}-${props.regionCode}-live-streaming-domain-appsync-url`,
    });

    new cdk.CfnOutput(this, 'StreamingAppSyncApiId', {
      value: this.apiId,
      description: 'Live Streaming Domain AppSync GraphQL API ID',
      exportName: `${props.environment}-${props.regionCode}-live-streaming-domain-appsync-id`,
    });
  }
}
