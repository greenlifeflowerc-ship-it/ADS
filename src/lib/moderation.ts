/**
 * Lightweight prompt moderation gate (spec §9). This is a minimal keyword guard
 * as a safety backstop — image/video vendors apply their own moderation. Extend
 * BANNED or swap in a real moderation API as needed.
 */
const BANNED: RegExp[] = [
  /\bchild\s*(porn|sexual)/i,
  /\bcsam\b/i,
  /\bnon-?consensual\b/i,
];

export function moderateText(text: string): { ok: boolean; reason?: string } {
  for (const re of BANNED) {
    if (re.test(text)) return { ok: false, reason: "Prompt blocked by content policy" };
  }
  return { ok: true };
}
