/**
 * Validation helpers for Live Streaming Domain GraphQL lambdas.
 */

import {
  requireAuthenticatedUser as requireAuthenticatedUserCore,
  PLATFORM_DUAL_ROLE_DEFAULT_COLLECTOR_FACING,
  PLATFORM_DUAL_ROLE_DEFAULT_GRAPHQL,
  type DualRoleAmbiguousDefault,
  type RequiredMode,
} from "./active-mode";

export function validateId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > 200) return null;
  return trimmed;
}

export function validateLimit(raw: unknown, defaultValue = 20, max = 100): number {
  if (raw == null) return defaultValue;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1) return defaultValue;
  return Math.min(n, max);
}

export function parseNextToken(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function encodeNextToken(key?: Record<string, unknown> | null): string | null {
  if (!key || Object.keys(key).length === 0) return null;
  return Buffer.from(JSON.stringify(key), 'utf8').toString('base64url');
}

const REQUIRED_ACTIVE_MODE: RequiredMode = 'both';

function dualDefaultFor(requiredMode: RequiredMode): DualRoleAmbiguousDefault {
  return requiredMode === 'collector'
    ? PLATFORM_DUAL_ROLE_DEFAULT_COLLECTOR_FACING
    : PLATFORM_DUAL_ROLE_DEFAULT_GRAPHQL;
}

export function requireAuthenticatedUser(
  event: { identity?: { sub?: string; claims?: { sub?: string } } },
  requiredMode: RequiredMode = REQUIRED_ACTIVE_MODE,
): string | null {
  return requireAuthenticatedUserCore(event, requiredMode, dualDefaultFor(requiredMode));
}
