import test from "node:test";
import assert from "node:assert/strict";
import { getSchedulePosition, getScheduleEventEnd } from "../scripts/schedule-now.js";

test("current-time marker interpolates half-hour slots across midnight", () => {
    const times = ["2026-10-10T23:00:00-04:00", "2026-10-11T00:00:00-04:00", "2026-10-11T00:30:00-04:00"].map(Date.parse);
    assert.deepEqual(getSchedulePosition(times, Date.parse("2026-10-11T04:15:00Z")), { index: 1, progress: 0.5 });
    assert.deepEqual(getSchedulePosition(times, times[1]), { index: 1, progress: 0 });
    assert.equal(getSchedulePosition(times, times[0] - 1), null);
    assert.equal(getSchedulePosition(times, times[2]), null);
    assert.equal(getSchedulePosition([], Date.now()), null);
});

test("event highlights respect explicit ends and midnight rather than row height", () => {
    assert.equal(getScheduleEventEnd("2026-10-10T11:00:00-04:00", "11:00–11:30 AM", 0), Date.parse("2026-10-10T11:30:00-04:00"));
    assert.equal(getScheduleEventEnd("2026-10-10T21:00:00-04:00", "9:00–9:30 PM", 0), Date.parse("2026-10-10T21:30:00-04:00"));
    assert.equal(getScheduleEventEnd("2026-10-10T21:00:00-04:00", "9:00–10:00 PM", 0), Date.parse("2026-10-10T22:00:00-04:00"));
    assert.equal(getScheduleEventEnd("2026-10-10T23:00:00-04:00", "11:00 PM–12:00 AM", 0), Date.parse("2026-10-11T00:00:00-04:00"));
    assert.equal(getScheduleEventEnd("2026-10-10T23:00:00-04:00", "continues overnight", 123), 123);
});
