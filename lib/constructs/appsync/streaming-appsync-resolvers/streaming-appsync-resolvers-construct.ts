import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface StreamingAppSyncResolversConstructProps {
  api: appsync.IGraphqlApi;
  createStreamLambda?: lambda.IFunction;
  startStreamLambda?: lambda.IFunction;
  endStreamLambda?: lambda.IFunction;
  getStreamLambda?: lambda.IFunction;
  listStreamsLambda?: lambda.IFunction;
  trackViewerLambda?: lambda.IFunction;
  getViewerCountLambda?: lambda.IFunction;
}

export class StreamingAppSyncResolversConstruct extends Construct {
  constructor(scope: Construct, id: string, props: StreamingAppSyncResolversConstructProps) {
    super(scope, id);

    if (props.createStreamLambda) {
      const createStreamDataSource = props.api.addLambdaDataSource(
        'CreateStreamDataSource',
        props.createStreamLambda
      );

      createStreamDataSource.createResolver('CreateStreamResolver', {
        typeName: 'Mutation',
        fieldName: 'createStream',
        requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
        responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
      });
    }

    if (props.startStreamLambda) {
      const startStreamDataSource = props.api.addLambdaDataSource(
        'StartStreamDataSource',
        props.startStreamLambda
      );

      startStreamDataSource.createResolver('StartStreamResolver', {
        typeName: 'Mutation',
        fieldName: 'startStream',
        requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
        responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
      });
    }

    if (props.endStreamLambda) {
      const endStreamDataSource = props.api.addLambdaDataSource(
        'EndStreamDataSource',
        props.endStreamLambda
      );

      endStreamDataSource.createResolver('EndStreamResolver', {
        typeName: 'Mutation',
        fieldName: 'endStream',
        requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
        responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
      });
    }

    if (props.getStreamLambda) {
      const getStreamDataSource = props.api.addLambdaDataSource(
        'GetStreamDataSource',
        props.getStreamLambda
      );

      getStreamDataSource.createResolver('GetStreamResolver', {
        typeName: 'Query',
        fieldName: 'getStream',
        requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
        responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
      });
    }

    if (props.listStreamsLambda) {
      const listStreamsDataSource = props.api.addLambdaDataSource(
        'ListStreamsDataSource',
        props.listStreamsLambda
      );

      listStreamsDataSource.createResolver('ListStreamsResolver', {
        typeName: 'Query',
        fieldName: 'listStreams',
        requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
        responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
      });
    }

    // Note: trackViewer and getViewerCount are event-driven/internal operations
    // trackViewer is called when viewers join/leave (not exposed as GraphQL mutation)
    // getViewerCount is calculated from getStreamViewers query result
    // if (props.trackViewerLambda) {
    //   const trackViewerDataSource = props.api.addLambdaDataSource(
    //     'TrackViewerDataSource',
    //     props.trackViewerLambda
    //   );

    //   trackViewerDataSource.createResolver('TrackViewerResolver', {
    //     typeName: 'Mutation',
    //     fieldName: 'trackViewer',
    //     requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
    //     responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    //   });
    // }

    // if (props.getViewerCountLambda) {
    //   const getViewerCountDataSource = props.api.addLambdaDataSource(
    //     'GetViewerCountDataSource',
    //     props.getViewerCountLambda
    //   );

    //   getViewerCountDataSource.createResolver('GetViewerCountResolver', {
    //     typeName: 'Query',
    //     fieldName: 'getViewerCount',
    //     requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
    //     responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    //   });
    // }
  }
}
