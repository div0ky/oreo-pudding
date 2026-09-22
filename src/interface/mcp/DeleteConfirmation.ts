import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Payload embedded in a delete-confirmation token.
 */
interface DeleteConfirmationPayload {
  /**
   * The event ID the token authorizes deleting.
   */
  eventId: string;
  /**
   * The resolved calendar path holding the event.
   */
  calendarPath: string;
  /**
   * Unix timestamp (seconds) after which the token is no longer valid.
   */
  exp: number;
}

/**
 * Result of verifying a delete-confirmation token.
 */
export interface DeleteConfirmationResult {
  /**
   * Whether the token is valid for the expected event.
   */
  valid: boolean;
  /**
   * Machine-readable reason when the token is invalid.
   */
  reason?: "malformed" | "signature" | "expired" | "mismatch";
  /**
   * The verified payload when the token is valid.
   */
  payload?: DeleteConfirmationPayload;
}

/**
 * Token lifetime in seconds (10 minutes).
 */
export const DELETE_CONFIRMATION_TTL_SECONDS = 10 * 60;

let ephemeralSecret: Buffer | null = null;

/**
 * Resolves the HMAC signing secret. Prefers DELETE_CONFIRM_SECRET, falls back
 * to BEARER_TOKEN so multi-instance deployments share a secret, and finally
 * generates an ephemeral secret (tokens valid only until restart).
 */
function resolveSecret(): Buffer {
  const configured = process.env.DELETE_CONFIRM_SECRET || process.env.BEARER_TOKEN;
  if (configured && configured.trim() !== "") {
    return Buffer.from(configured, "utf8");
  }
  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(32);
    console.error(
      "DeleteConfirmation: no DELETE_CONFIRM_SECRET or BEARER_TOKEN set; " +
      "using an ephemeral secret. Confirmation tokens will not survive restarts."
    );
  }
  return ephemeralSecret;
}

/**
 * Encodes a payload to unpadded base64url.
 */
function encodePayload(payload: DeleteConfirmationPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Mints a signed delete-confirmation token binding an event ID and calendar
 * path to an expiry. Stateless: verifiable on any instance sharing the secret.
 */
export function mintDeleteConfirmation(
  eventId: string,
  calendarPath: string,
  ttlSeconds: number = DELETE_CONFIRMATION_TTL_SECONDS,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): { token: string; expiresAt: string } {
  const payload: DeleteConfirmationPayload = {
    eventId,
    calendarPath,
    exp: nowSeconds + ttlSeconds
  };
  const encoded = encodePayload(payload);
  const signature = createHmac("sha256", resolveSecret())
    .update(`v1.${encoded}`, "utf8")
    .digest("base64url");
  return {
    token: `v1.${encoded}.${signature}`,
    expiresAt: new Date(payload.exp * 1000).toISOString()
  };
}

/**
 * Verifies a delete-confirmation token for the expected event ID.
 */
export function verifyDeleteConfirmation(
  token: string,
  expectedEventId: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): DeleteConfirmationResult {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !parts[1] || !parts[2]) {
    return { valid: false, reason: "malformed" };
  }

  const encoded = parts[1] as string;
  const provided = parts[2] as string;
  const expected = createHmac("sha256", resolveSecret())
    .update(`v1.${encoded}`, "utf8")
    .digest("base64url");

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "signature" };
  }

  let payload: DeleteConfirmationPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return { valid: false, reason: "malformed" };
  }

  if (
    typeof payload.eventId !== "string" ||
    typeof payload.calendarPath !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return { valid: false, reason: "malformed" };
  }

  if (payload.exp <= nowSeconds) {
    return { valid: false, reason: "expired" };
  }

  if (payload.eventId !== expectedEventId) {
    return { valid: false, reason: "mismatch" };
  }

  return { valid: true, payload };
}
