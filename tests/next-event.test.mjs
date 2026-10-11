import test from "node:test";
import assert from "node:assert/strict";
import { getNextEvent, formatTimeUntil, getLiveEvents } from "../scripts/next-event.js";

test("next event advances through the schedule and ends after the last start", () => {
    const first = { start: Date.parse("2026-10-10T09:00:00-04:00"), title: "Check-in begins" };
    const second = { start: Date.parse("2026-10-10T10:00:00-04:00"), title: "Opening ceremony" };
    const events = [first, second];

    assert.equal(getNextEvent(events, first.start - 1), first);
    assert.equal(getNextEvent(events, first.start), second);
    assert.equal(getNextEvent(events, second.start), null);
});

test("time until next event uses compact days, hours, and minutes", () => {
    assert.equal(formatTimeUntil(1), "1m");
    assert.equal(formatTimeUntil(61_000), "2m");
    assert.equal(formatTimeUntil(3_900_000), "1h 5m");
    assert.equal(formatTimeUntil(93_900_000), "1d 2h");
});

test("live panel includes simultaneous events and advances at start and end boundaries", () => {
    const now = Date.parse("2026-10-10T21:30:00-04:00");
    const ongoing = { start: now - 1800000, end: now + 1800000 };
    const ended = { start: now - 1800000, end: now };
    const starting = { start: now, end: now + 1800000 };
    const upcoming = { start: now + 1800000, end: now + 3600000 };
    const hourAway = { start: now + 3600000, end: now + 7200000 };
    const later = { start: now + 3600001, end: now + 7200000 };
    assert.deepEqual(getLiveEvents([ongoing, ended, starting, upcoming, hourAway, later], now), {
        current: [ongoing, starting], upcoming: [upcoming, hourAway],
    });
});
