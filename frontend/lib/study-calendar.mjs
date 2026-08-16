const DAY_MS = 86_400_000;
const SEARCH_MARGIN_MS = 48 * 60 * 60 * 1000;

export const STUDY_TIME_ZONE = "America/Sao_Paulo";

const calendarFormatter = new Intl.DateTimeFormat("en-US-u-ca-iso8601-nu-latn", {
  timeZone: STUDY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dayRangeCache = new Map();

function assertValidDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("A valid instant is required for StudyFlash calendar calculations.");
  }
  return date;
}

export function studyDateParts(value) {
  const date = assertValidDate(value);
  const parts = {};
  for (const part of calendarFormatter.formatToParts(date)) {
    if (part.type === "year" || part.type === "month" || part.type === "day") {
      parts[part.type] = Number(part.value);
    }
  }
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function studyCalendarDayOrdinal(value) {
  const { year, month, day } = studyDateParts(value);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function studyCalendarDayDifference(current, previous) {
  return studyCalendarDayOrdinal(current) - studyCalendarDayOrdinal(previous);
}

function firstInstantAtOrAfterStudyDay(targetOrdinal) {
  const estimate = targetOrdinal * DAY_MS;
  let lower = estimate - SEARCH_MARGIN_MS;
  let upper = estimate + SEARCH_MARGIN_MS;

  while (studyCalendarDayOrdinal(new Date(lower)) >= targetOrdinal) {
    lower -= DAY_MS;
  }
  while (studyCalendarDayOrdinal(new Date(upper)) < targetOrdinal) {
    upper += DAY_MS;
  }

  while (lower + 1 < upper) {
    const middle = lower + Math.floor((upper - lower) / 2);
    if (studyCalendarDayOrdinal(new Date(middle)) >= targetOrdinal) {
      upper = middle;
    } else {
      lower = middle;
    }
  }

  return upper;
}

export function studyDayRange(value) {
  const ordinal = studyCalendarDayOrdinal(value);
  let cached = dayRangeCache.get(ordinal);
  if (!cached) {
    cached = {
      startMs: firstInstantAtOrAfterStudyDay(ordinal),
      endMs: firstInstantAtOrAfterStudyDay(ordinal + 1),
    };
    dayRangeCache.set(ordinal, cached);
  }
  return { start: new Date(cached.startMs), end: new Date(cached.endMs) };
}
