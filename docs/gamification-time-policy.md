# StudyFlash gamification calendar policy

StudyFlash currently has no persisted per-user timezone preference. Until such a preference is introduced, every calendar-day gamification rule uses the canonical IANA timezone **`America/Sao_Paulo`**.

## What resets at midnight

The following rules use midnight in `America/Sao_Paulo`, independent of the operating system, container, database or GitHub runner timezone:

- daily XP cap for flashcard creation;
- daily XP-eligible exam-session cap;
- same-day / consecutive-day / missed-day streak transitions;
- streak updates triggered by durable study-session reviews.

Database queries use an explicit `[start, end)` range for the StudyFlash civil date. Calendar-day differences are computed from civil year/month/day values rather than elapsed 24-hour durations, so historical 23-hour or 25-hour DST days remain one calendar day.

## User timezone policy

There is no silent inference from browser locale or deployment region. If per-user timezones are added later, the timezone must become persisted account data and all daily boundaries must be derived from that stored value. Changing a user's timezone must define when the new zone takes effect and must not retroactively award duplicate daily XP or streak bonuses.

Until that migration exists, changing the canonical timezone is a product/data policy change and requires regression tests plus explicit release documentation.
