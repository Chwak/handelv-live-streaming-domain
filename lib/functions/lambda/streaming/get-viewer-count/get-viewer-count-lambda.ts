import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { requireAuthenticatedUser, validateId } from '../../../../utils/streaming-validation';
import { initTelemetryLogger } from "../../../../utils/telemetry-logger";

const STREAM_VIEWERS_TABLE = process.env.STREAM_VIEWERS_TABLE_NAME;
const STREAMS_TABLE = process.env.STREAMS_TABLE_NAME;

export const handler = async (event: { arguments?: { streamId?: unknown }; identity?: { sub?: string; claims?: { sub?: string } } }) => {
  initTelemetryLogger(event, { domain: "live-streaming-domain", service: "get-viewer-count" });
  if (!STREAM_VIEWERS_TABLE || !STREAMS_TABLE) throw new Error('Internal server error');

  const streamId = validateId(event.arguments?.streamId);
  if (!streamId) throw new Error('Invalid input format');

  const auth = requireAuthenticatedUser(event);
  if (!auth) throw new Error('Not authenticated');

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  const streamResult = await client.send(
    new GetCommand({
      TableName: STREAMS_TABLE,
      Key: { streamId },
    })
  );
  if (!streamResult.Item) throw new Error('Stream not found');
  if ((streamResult.Item.makerUserId as string) !== auth) throw new Error('Forbidden');

  const result = await client.send(
    new QueryCommand({
      TableName: STREAM_VIEWERS_TABLE,
      KeyConditionExpression: 'streamId = :sid',
      ExpressionAttributeValues: { ':sid': streamId },
      Select: 'COUNT',
    })
  );

  return { streamId, viewerCount: result.Count ?? 0 };
};