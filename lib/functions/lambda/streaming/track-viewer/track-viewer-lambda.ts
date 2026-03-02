import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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

const STREAM_VIEWERS_TABLE = process.env.STREAM_VIEWERS_TABLE_NAME;
const LIVE_STREAMS_TABLE = process.env.LIVE_STREAMS_TABLE_NAME;

type Action = 'join' | 'leave';

export const handler = async (event: {
  arguments?: { streamId?: unknown; viewerId?: unknown; action?: unknown };
  identity?: { sub?: string; claims?: { sub?: string } };
  headers?: Record<string, string>;
}) => {
  initTelemetryLogger(event, { domain: "live-streaming-domain", service: "track-viewer" });
  const traceparent = resolveTraceparent(event);
  if (!STREAM_VIEWERS_TABLE || !LIVE_STREAMS_TABLE) throw new Error('Internal server error');

  const streamId = validateId(event.arguments?.streamId);
  const viewerId = validateId(event.arguments?.viewerId);
  const action = event.arguments?.action === 'leave' ? 'leave' : 'join';
  if (!streamId || !viewerId) throw new Error('Invalid input format');

  const auth = requireAuthenticatedUser(event, 'collector');
  if (!auth || auth !== viewerId) throw new Error('Forbidden');

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  const streamResult = await client.send(
    new GetCommand({
      TableName: LIVE_STREAMS_TABLE,
      Key: { streamId },
    })
  );
  const stream = streamResult.Item as Record<string, unknown> | undefined;
  if (!stream) throw new Error('Stream not found');
  if (action === 'join' && (stream.status as string) !== 'LIVE') throw new Error('Stream is not live');

  const now = new Date().toISOString();

  if (action === 'join') {
    try {
      await client.send(
        new PutCommand({
          TableName: STREAM_VIEWERS_TABLE,
          Item: {
            streamId,
            viewerId,
            joinedAt: now,
          },
          ConditionExpression: 'attribute_not_exists(viewerId)',
        })
      );
      await client.send(
        new UpdateCommand({
          TableName: LIVE_STREAMS_TABLE,
          Key: { streamId },
          UpdateExpression: 'SET viewerCount = if_not_exists(viewerCount, :zero) + :one, updatedAt = :now',
          ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':now': now },
        })
      );
    } catch (err: any) {
      if (err?.name !== 'ConditionalCheckFailedException') {
        throw err;
      }
    }
  } else {
    try {
      await client.send(
        new DeleteCommand({
          TableName: STREAM_VIEWERS_TABLE,
          Key: { streamId, viewerId },
          ConditionExpression: 'attribute_exists(viewerId)',
        })
      );
      await client.send(
        new UpdateCommand({
          TableName: LIVE_STREAMS_TABLE,
          Key: { streamId },
          UpdateExpression: 'SET viewerCount = viewerCount - :one, updatedAt = :now',
          ConditionExpression: 'viewerCount > :zero',
          ExpressionAttributeValues: { ':one': 1, ':zero': 0, ':now': now },
        })
      );
    } catch (err: any) {
      if (err?.name !== 'ConditionalCheckFailedException') {
        throw err;
      }
    }
  }

  return { streamId, viewerId, action, at: now };
};