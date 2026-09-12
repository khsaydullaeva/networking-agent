import type { Links } from "@/lib/types";

// The QR payload is the scanning phone's own exportable profile — there's
// no dedicated pairing endpoint in backend/README.md, so the two phones
// exchange profile info peer-to-peer via camera, then each independently
// POSTs its own /connections record after the capture-context screen.
export interface ConnectPayload {
  user_id: string;
  name: string;
  org?: string;
  links: Links;
}

export function encodeConnectPayload(payload: ConnectPayload): string {
  return JSON.stringify(payload);
}

export function decodeConnectPayload(raw: string): ConnectPayload | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.name === "string" && typeof parsed?.user_id === "string") {
      return parsed as ConnectPayload;
    }
    return null;
  } catch {
    return null;
  }
}

// Camera-under-stage-lights fallback: a 6-digit code is easy to read aloud
// and type, but too short to carry a full profile — the fallback flow asks
// for the other person's name directly instead of auto-fetching it.
export function generateFallbackCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
