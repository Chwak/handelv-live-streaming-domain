import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { requireAuthenticatedUser, validateId } from '../../../../utils/streaming-validation';
import { initTelemetryLogger } from "../../../../utils/telemetry-logger";

function resolveTraceparent(event: { headers?: Record<string, string> }): string {
  const headerTraceparent = event.headers?.traceparent || event.headers?.Traceparent;
  const isValid = headerTraceparent && /^\d{2}-[0-9a-f]{32}-[0-9a-f]{16}-\d{2}$/i.test(headerTraceparent);
  if (isValid) return headerTraceparent;
  const traceId = randomUUID().replace(/-/g, '');
  const spanId = randomUUID().replace(/-/g, '').slice(0, 16);
  return `00-${traceId}-${spanId}-01`;
}

const LIVE_STREAMS_TABLE = process.env.LIVE_STREAMS_TABLE_NAME;

export const handler = async (event: {
  arguments?: { streamId?: unknown };
  identity?: { sub?: string; claims?: { sub?: string } };
  headers?: Record<string, string>;
}) => {
  initTelemetryLogger(event, { domain: "live-streaming-domain", service: "end-stream" });
  const traceparent = resolveTraceparent(event);
  if (!LIVE_STREAMS_TABLE) throw new Error('Internal server error');

  const streamId = validateId(event.arguments?.streamId);
  if (!streamId) throw new Error('Invalid input format');

  const auth = requireAuthenticatedUser(event, 'maker');
  if (!auth) throw new Error('Not authenticated');

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  const getResult = await client.send(
    new GetCommand({
      TableName: LIVE_STREAMS_TABLE,
      Key: { streamId },
    })
  );
  const stream = getResult.Item as Record<string, unknown> | undefined;
  if (!stream) throw new Error('Stream not found');
  if ((stream.makerUserId as string) !== auth) throw new Error('Forbidden');
  if ((stream.status as string) !== 'LIVE') throw new Error('Stream is not live');

  const now = new Date().toISOString();

  const updateResult = await client.send(
    new UpdateCommand({
      TableName: LIVE_STREAMS_TABLE,
      Key: { streamId },
      UpdateExpression: 'SET #st = :status, endedAt = :now, updatedAt = :now',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':status': 'ENDED', ':now': now },
      ReturnValues: 'ALL_NEW',
    })
  );

  return (updateResult.Attributes ?? stream) as Record<string, unknown>;
};