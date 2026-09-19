/** The calendar used for every Samjho classroom deadline. */
export const INDIA_TIME_ZONE = "Asia/Kolkata";

// India has no daylight-saving transition, so a local classroom deadline can
// be converted without consulting the browser's own time zone.
const INDIA_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Interpret a native `<input type="datetime-local">` value as Indian Standard
 * Time and return the absolute instant stored by the API. A browser treats that
 * input as *its* local zone by default; classroom deadlines belong to the CBSE
 * calendar instead, so that behaviour would make the same typed time mean a
 * different deadline outside India.
 */
export function indiaDateTimeLocalToIso(value: string): string | null {
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;

  // `Date.UTC` treats years 0–99 as 1900–1999. Set the fields instead so this
  // parser remains honest for every four-digit year a native control can emit.
  const asUtc = new Date(0);
  asUtc.setUTCFullYear(year, month - 1, day);
  asUtc.setUTCHours(hour, minute, 0, 0);
  if (
    asUtc.getUTCFullYear() !== year ||
    asUtc.getUTCMonth() !== month - 1 ||
    asUtc.getUTCDate() !== day ||
    asUtc.getUTCHours() !== hour ||
    asUtc.getUTCMinutes() !== minute
  ) {
    return null;
  }

  return new Date(asUtc.getTime() - INDIA_OFFSET_MS).toISOString();
}
