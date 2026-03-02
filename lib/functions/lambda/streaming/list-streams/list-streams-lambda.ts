import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, type QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { initTelemetryLogger } from "../../../../utils/telemetry-logger";
import {
  encodeNextToken,
  parseNextToken,
  requireAuthenticatedUser,
  validateId,
  validateLimit,
} from '../../../../utils/streaming-validation';

const STREAMS_TABLE = process.env.STREAMS_TABLE_NAME;
const GSI1_MAKER = 'GSI1-MakerUserId';
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const handler = async (event: {
  arguments?: {
    makerUserId?: unknown;
    status?: unknown;
    limit?: unknown;
    nextToken?: unknown;
  };
  identity?: { sub?: string; claims?: { sub?: string } };
}) => {
  initTelemetryLogger(event, { domain: "live-streaming-domain", service: "list-streams" });
  if (!STREAMS_TABLE) throw new Error('Internal server error');

  const args = event.arguments ?? {};
  const makerUserId = args.makerUserId != null ? validateId(args.makerUserId) : null;
  const status = typeof args.status === 'string' ? args.status.trim().toUpperCase() : null;
  const authUserId = requireAuthenticatedUser(event);
  if (!authUserId) throw new Error('Not authenticated');
  if (!makerUserId) throw new Error('makerUserId is required');
  if (makerUserId !== authUserId) throw new Error('Forbidden');
  const limit = validateLimit(args.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const nextToken = parseNextToken(args.nextToken);

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  const queryInput: Record<string, unknown> = {
    TableName: STREAMS_TABLE,
    IndexName: GSI1_MAKER,
    KeyConditionExpression: 'makerUserId = :uid',
    ExpressionAttributeValues: { ':uid': makerUserId },
    Limit: limit,
  };
  if (status) {
    queryInput.FilterExpression = '#st = :st';
    queryInput.ExpressionAttributeNames = { '#st': 'status' };
    (queryInput.ExpressionAttributeValues as Record<string, unknown>)[':st'] = status;
  }
  if (nextToken && typeof nextToken === 'object' && Object.keys(nextToken).length > 0) {
    queryInput.ExclusiveStartKey = nextToken as Record<string, unknown>;
  }

  const result = await client.send(new QueryCommand(queryInput as QueryCommandInput));
  const items = (result.Items ?? []) as Record<string, unknown>[];
  const newNextToken = result.LastEvaluatedKey
    ? encodeNextToken(result.LastEvaluatedKey as Record<string, unknown>)
    : null;

  return { items, nextToken: newNextToken };
};