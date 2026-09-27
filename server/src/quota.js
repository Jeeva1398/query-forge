// Free-tier quotas reset at midnight Pacific time
const PT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function pacificParts(date) {
  return Object.fromEntries(
    PT.formatToParts(date).map((p) => [p.type, p.value]),
  );
}

export function pacificDay(date = new Date()) {
  const p = pacificParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function nextPacificMidnight(date = new Date()) {
  const p = pacificParts(date);
  const elapsed =
    Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second);
  return new Date(date.getTime() + (86400 - elapsed) * 1000);
}

// Works out how long a model should be skipped after a 429
export function blockUntil(error, now = new Date()) {
  const text = String(error?.message || '');
  if (/per\s*day|PerDay/i.test(text)) return nextPacificMidnight(now);
  const delay = text.match(
    /retry(?:Delay)?["\s:]*(?:in\s*)?"?(\d+(?:\.\d+)?)s/i,
  );
  const seconds = delay ? Math.ceil(Number(delay[1])) : 60;
  return new Date(now.getTime() + seconds * 1000);
}

export function createQuota(now = () => new Date()) {
  const models = new Map();
  let day = pacificDay(now());

  function entry(model) {
    const today = pacificDay(now());
    if (today !== day) {
      day = today;
      models.clear();
    }
    if (!models.has(model)) {
      models.set(model, { used: 0, blockedUntil: null, reason: null });
    }
    return models.get(model);
  }

  return {
    isBlocked(model) {
      const e = entry(model);
      return !!e.blockedUntil && e.blockedUntil > now();
    },
    recordUse(model) {
      entry(model).used += 1;
    },
    // reason: 'quota' (429) or 'busy' (503, model overloaded)
    block(model, until, reason = 'quota') {
      const e = entry(model);
      e.blockedUntil = until;
      e.reason = reason;
    },
    reasonFor(model) {
      return this.isBlocked(model) ? entry(model).reason : null;
    },
    snapshot(model) {
      const e = entry(model);
      const blocked = !!e.blockedUntil && e.blockedUntil > now();
      return {
        usedToday: e.used,
        blockedUntil: blocked ? e.blockedUntil.toISOString() : null,
        reason: blocked ? e.reason : null,
      };
    },
    earliestUnblock(list) {
      const times = list
        .map((m) => entry(m).blockedUntil)
        .filter((t) => t && t > now());
      return times.length ? new Date(Math.min(...times)) : null;
    },
  };
}
