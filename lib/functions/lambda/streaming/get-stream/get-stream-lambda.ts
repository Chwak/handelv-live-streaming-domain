import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { requireAuthenticatedUser, validateId } from '../../../../utils/streaming-validation';
import { initTelemetryLogger } from "../../../../utils/telemetry-logger";

const STREAMS_TABLE = process.env.STREAMS_TABLE_NAME;

export const handler = async (event: { arguments?: { streamId?: unknown }; identity?: { sub?: string; claims?: { sub?: string } } }) => {
  initTelemetryLogger(event, { domain: "live-streaming-domain", service: "get-stream" });
  if (!STREAMS_TABLE) throw new Error('Internal server error');

  const streamId = validateId(event.arguments?.streamId);
  if (!streamId) throw new Error('Invalid input format');

  const auth = requireAuthenticatedUser(event);
  if (!auth) throw new Error('Not authenticated');

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  const result = await client.send(
    new GetCommand({
      TableName: STREAMS_TABLE,
      Key: { streamId },
    })
  );

  if (!result.Item) throw new Error('Stream not found');
  if ((result.Item.makerUserId as string) !== auth) throw new Error('Forbidden');
  return result.Item as Record<string, unknown>;
};