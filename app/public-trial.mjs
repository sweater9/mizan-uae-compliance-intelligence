/**
 * A single launch window for everyone. The operator sets this timestamp once;
 * requests and server restarts must never start or extend the trial.
 * @param {string | undefined} startAt UTC ISO timestamp, as produced by toISOString().
 * @param {number} now
 */
export function publicTrialStatus(startAt, now = Date.now()) {
  const start = new Date(startAt || "");
  const canonical = startAt?.replace(/(?<=\d{2}:\d{2}:\d{2})Z$/, ".000Z");
  if (!startAt || !Number.isFinite(start.getTime()) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(startAt) ||
      start.toISOString() !== canonical || !Number.isFinite(now)) {
    return { status: "unconfigured", startsAt: null, endsAt: null,
      message: "Public free access has not launched yet." };
  }

  // One calendar month in UTC, clamping month-end dates (Jan 31 -> Feb 28/29).
  const end = new Date(start);
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const lastDay = new Date(end);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  end.setUTCDate(Math.min(start.getUTCDate(), lastDay.getUTCDate()));
  const status = now < start.getTime() ? "scheduled" : now >= end.getTime() ? "ended" : "active";
  return { status, startsAt: start.toISOString(), endsAt: end.toISOString(),
    message: status === "active"
      ? "Free for everyone for one month from launch. No account or payment details required."
      : status === "scheduled" ? "Public free access opens soon."
      : "The free month has ended. Live AI requests are paused. You have not been charged." };
}

/** @param {string | undefined} startAt */
export function publicTrialResponse(startAt) {
  return Response.json(publicTrialStatus(startAt), { headers: { "Cache-Control": "no-store" } });
}

/** @param {string | undefined} startAt */
export function publicTrialDenial(startAt) {
  const trial = publicTrialStatus(startAt);
  if (trial.status === "active") return null;
  const status = trial.status === "ended" ? 410 : trial.status === "scheduled" ? 403 : 503;
  return Response.json({ error: trial.message, code: `public_trial_${trial.status}` },
    { status, headers: { "Cache-Control": "no-store" } });
}
