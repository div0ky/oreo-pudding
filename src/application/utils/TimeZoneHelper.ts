export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch (e) {
    return false;
  }
}

export function parseInTimeZone(dateStr: string, timeZone: string = "America/Chicago"): Date {
  const trimmed = dateStr.trim();
  // Check if there is an explicit timezone indicator (Z or +/-offset)
  const hasOffset = /[Zz]|[+-]\d{2}(:?\d{2})?$/.test(trimmed);
  
  if (hasOffset) {
    return new Date(trimmed);
  }
  
  // Otherwise, it's local/floating time. Parse it in the specified timeZone.
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?)?/);
  if (!match) {
    // Fallback to standard parser if regex fails
    return new Date(trimmed);
  }
  
  const [_, y = "", m = "", d = "", hh = "00", mm = "00", ss = "00", ms = "0"] = match;
  
  // Construct UTC date guess:
  const utcGuess = new Date(Date.UTC(
    parseInt(y, 10),
    parseInt(m, 10) - 1,
    parseInt(d, 10),
    parseInt(hh, 10),
    parseInt(mm, 10),
    parseInt(ss, 10),
    parseInt(ms.padEnd(3, "0").substring(0, 3), 10)
  ));
  
  // Determine target timezone parts for this instant
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });
  
  const parts = formatter.formatToParts(utcGuess);
  const partMap = new Map(parts.map(p => [p.type, p.value]));
  
  const tzYear = parseInt(partMap.get("year")!, 10);
  const tzMonth = parseInt(partMap.get("month")!, 10);
  const tzDay = parseInt(partMap.get("day")!, 10);
  let tzHour = parseInt(partMap.get("hour")!, 10);
  if (tzHour === 24) tzHour = 0;
  const tzMin = parseInt(partMap.get("minute")!, 10);
  const tzSec = parseInt(partMap.get("second")!, 10);
  
  const tzUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin, tzSec, utcGuess.getUTCMilliseconds());
  const offset = utcGuess.getTime() - tzUtc;
  
  return new Date(utcGuess.getTime() + offset);
}

export function formatInTimeZone(date: Date, timeZone: string = "America/Chicago"): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const partMap = new Map(parts.map(p => [p.type, p.value]));
  
  const year = partMap.get("year");
  const month = partMap.get("month");
  const day = partMap.get("day");
  let hour = partMap.get("hour")!;
  if (hour === "24") hour = "00";
  const minute = partMap.get("minute");
  const second = partMap.get("second");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  
  const tzYear = parseInt(year!, 10);
  const tzMonth = parseInt(month!, 10);
  const tzDay = parseInt(day!, 10);
  const tzHour = parseInt(hour, 10);
  const tzMin = parseInt(minute!, 10);
  const tzSec = parseInt(second!, 10);
  
  const tzUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin, tzSec);
  const utcWithoutMs = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );
  
  const offsetDiffMinutes = Math.round((tzUtc - utcWithoutMs) / 60000);
  
  let offsetStr = "Z";
  if (offsetDiffMinutes !== 0) {
    const sign = offsetDiffMinutes > 0 ? "+" : "-";
    const absDiff = Math.abs(offsetDiffMinutes);
    const offsetHours = String(Math.floor(absDiff / 60)).padStart(2, "0");
    const offsetMins = String(absDiff % 60).padStart(2, "0");
    offsetStr = `${sign}${offsetHours}:${offsetMins}`;
  }
  
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}${offsetStr}`;
}
