import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface StreamingTablesConstructProps {
  environment: string;
  regionCode: string;
  removalPolicy?: cdk.RemovalPolicy;
}

export class StreamingTablesConstruct extends Construct {
  public readonly liveStreamsTable: dynamodb.Table;
  public readonly streamViewersTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: StreamingTablesConstructProps) {
    super(scope, id);

    const removalPolicy = props.removalPolicy ?? cdk.RemovalPolicy.DESTROY;

    // Live Streams Table
    this.liveStreamsTable = new dynamodb.Table(this, 'LiveStreamsTable', {
      tableName: `${props.environment}-${props.regionCode}-live-streaming-domain-live-streams-table`,
      partitionKey: {
        name: 'streamId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: removalPolicy,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: props.environment === 'prod' },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // GSI: streams by maker
    this.liveStreamsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-MakerUserId',
      partitionKey: {
        name: 'makerUserId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'startedAt',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // GSI: streams by status
    this.liveStreamsTable.addGlobalSecondaryIndex({
      indexName: 'GSI2-Status',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'startedAt',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Stream Viewers Table
    this.streamViewersTable = new dynamodb.Table(this, 'StreamViewersTable', {
      tableName: `${props.environment}-${props.regionCode}-live-streaming-domain-stream-viewers-table`,
      partitionKey: {
        name: 'streamId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'viewerId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: removalPolicy,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: props.environment === 'prod' },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });
  }
}
