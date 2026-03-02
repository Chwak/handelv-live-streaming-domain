import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
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

const STREAMS_TABLE = process.env.STREAMS_TABLE_NAME;

interface CreateStreamInput {
  makerUserId?: unknown;
  title?: unknown;
  description?: unknown;
  scheduledStartTime?: unknown;
}

function validateTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length < 1 || t.length > 200) return null;
  return t;
}

export const handler = async (event: {
  arguments?: { input?: CreateStreamInput };
  identity?: { sub?: string; claims?: { sub?: string } };
  headers?: Record<string, string>;
}) => {
  initTelemetryLogger(event, { domain: "live-streaming-domain", service: "create-stream" });
  const traceparent = resolveTraceparent(event);
  if (!STREAMS_TABLE) throw new Error('Internal server error');

  const input = event.arguments?.input ?? {};
  const makerUserId = validateId(input.makerUserId);
  const title = validateTitle(input.title);
  if (!makerUserId || !title) throw new Error('Invalid input format');

  const auth = requireAuthenticatedUser(event, 'maker');
  if (!auth || auth !== makerUserId) throw new Error('Forbidden');

  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 1000) : undefined;
  const scheduledStartTime = typeof input.scheduledStartTime === 'string' ? input.scheduledStartTime : undefined;

  const now = new Date().toISOString();
  const streamId = randomUUID();
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  await client.send(
    new PutCommand({
      TableName: STREAMS_TABLE,
      Item: {
        streamId,
        makerUserId,
        title,
        description: description ?? null,
        status: 'SCHEDULED',
        viewerCount: 0,
        scheduledStartTime: scheduledStartTime ?? null,
        createdAt: now,
        updatedAt: now,
      },
    })
  );

  return {
    streamId,
    makerUserId,
    title,
    description: description ?? null,
    status: 'SCHEDULED',
    viewerCount: 0,
    scheduledStartTime: scheduledStartTime ?? null,
    createdAt: now,
    updatedAt: now,
  };
};