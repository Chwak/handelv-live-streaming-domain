import * as cdk from "aws-cdk-lib";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import type { DomainStackProps } from "./domain-stack-props";
import { StreamingAppSyncConstruct } from "./constructs/appsync/streaming-appsync/streaming-appsync-construct";
import { StreamingTablesConstruct } from "./constructs/dynamodb/streaming-tables/streaming-tables-construct";
import { CreateStreamLambdaConstruct } from "./constructs/lambda/streaming/create-stream/create-stream-lambda-construct";
import { GetStreamLambdaConstruct } from "./constructs/lambda/streaming/get-stream/get-stream-lambda-construct";
import { ListStreamsLambdaConstruct } from "./constructs/lambda/streaming/list-streams/list-streams-lambda-construct";
import { StartStreamLambdaConstruct } from "./constructs/lambda/streaming/start-stream/start-stream-lambda-construct";
import { EndStreamLambdaConstruct } from "./constructs/lambda/streaming/end-stream/end-stream-lambda-construct";
import { TrackViewerLambdaConstruct } from "./constructs/lambda/streaming/track-viewer/track-viewer-lambda-construct";
import { GetViewerCountLambdaConstruct } from "./constructs/lambda/streaming/get-viewer-count/get-viewer-count-lambda-construct";
import { StreamingAppSyncResolversConstruct } from "./constructs/appsync/streaming-appsync-resolvers/streaming-appsync-resolvers-construct";

export class LiveStreamingDomainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DomainStackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add("Domain", "hand-made-live-streaming-domain");
    cdk.Tags.of(this).add("Environment", props.environment);
    cdk.Tags.of(this).add("Project", "hand-made");
    cdk.Tags.of(this).add("Region", props.regionCode);
    cdk.Tags.of(this).add("StackName", this.stackName);

    const removalPolicy = props.environment === 'prod'
      ? cdk.RemovalPolicy.RETAIN
      : cdk.RemovalPolicy.DESTROY;

    // Create DynamoDB tables
    const streamingTables = new StreamingTablesConstruct(this, "StreamingTables", {
      environment: props.environment,
      regionCode: props.regionCode,
      removalPolicy,
    });

    const streamingAppSync = new StreamingAppSyncConstruct(this, "StreamingAppSync", {
      environment: props.environment,
      regionCode: props.regionCode,
    });

    // Create Lambda functions
    const createStreamLambda = new CreateStreamLambdaConstruct(this, "CreateStreamLambda", {
      environment: props.environment,
      regionCode: props.regionCode,
      streamsTable: streamingTables.liveStreamsTable,
      removalPolicy,
    });

    const getStreamLambda = new GetStreamLambdaConstruct(this, "GetStreamLambda", {
      environment: props.environment,
      regionCode: props.regionCode,
      streamsTable: streamingTables.liveStreamsTable,
      removalPolicy,
    });

    const listStreamsLambda = new ListStreamsLambdaConstruct(this, "ListStreamsLambda", {
      environment: props.environment,
      regionCode: props.regionCode,
      streamsTable: streamingTables.liveStreamsTable,
      removalPolicy,
    });

    const startStreamLambda = new StartStreamLambdaConstruct(this, "StartStreamLambda", {
      environment: props.environment,
      regionCode: props.regionCode,
      liveStreamsTable: streamingTables.liveStreamsTable,
      removalPolicy,
    });

    const endStreamLambda = new EndStreamLambdaConstruct(this, "EndStreamLambda", {
      environment: props.environment,
      regionCode: props.regionCode,
      liveStreamsTable: streamingTables.liveStreamsTable,
      removalPolicy,
    });

    const trackViewerLambda = new TrackViewerLambdaConstruct(this, "TrackViewerLambda", {
      environment: props.environment,
      regionCode: props.regionCode,
      streamViewersTable: streamingTables.streamViewersTable,
      liveStreamsTable: streamingTables.liveStreamsTable,
      removalPolicy,
    });

    const getViewerCountLambda = new GetViewerCountLambdaConstruct(this, "GetViewerCountLambda", {
      environment: props.environment,
      regionCode: props.regionCode,
      streamViewersTable: streamingTables.streamViewersTable,
      removalPolicy,
    });

    // Create AppSync resolvers
    const streamingResolvers = new StreamingAppSyncResolversConstruct(this, "StreamingResolvers", {
      api: streamingAppSync.api,
      createStreamLambda: createStreamLambda.function,
      getStreamLambda: getStreamLambda.function,
      listStreamsLambda: listStreamsLambda.function,
      startStreamLambda: startStreamLambda.function,
      endStreamLambda: endStreamLambda.function,
      trackViewerLambda: trackViewerLambda.function,
      getViewerCountLambda: getViewerCountLambda.function,
    });
  }
}
