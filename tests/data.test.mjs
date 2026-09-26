import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseStandings, fetchStandings, standingsUrl } from "../scripts/leaderboard-data.js";
import { registrationClosesAt, registrationState, registrationUrls, registrationCountdown } from "../scripts/registration.js";
import { events, scheduleRooms } from "../scripts/events.js";

test("CSV handles escaped quotes, commas, line breaks, BOM and CRLF", () => {
    assert.deepEqual(parseCsv('\uFEFF"Teams","Score"\r\n"Sky, ""High""\nClub","1,000"\r\n'), [
        ["Teams", "Score"], ['Sky, "High"\nClub', "1,000"],
    ]);
    assert.throws(() => parseCsv('Teams,Score\n"unfinished,5'));
});

test("an empty valid sheet is awaiting scores, not an error", () => {
    assert.deepEqual(parseStandings('"Teams","Score"\n'), { teams: [], pending: 0 });
});

test("rankings preserve the sheet's order, share ties and retain zero scores", () => {
    assert.deepEqual(parseStandings('Teams,Score\nComets,12.5\nRockets,12.5\nOrbit,0\nPending,\n,0'), {
        teams: [
            { name: "Comets", score: 12.5, rank: 1 },
            { name: "Rockets", score: 12.5, rank: 1 },
            { name: "Orbit", score: 0, rank: 3 },
        ], pending: 1,
    });
    assert.equal(parseStandings('Teams,Score\nFirst,1\nSecond,100').teams[0].name, "First");
    assert.equal(parseStandings('Teams,Score\nComets,"1,234"').teams[0].score, 1234);
});

test("invalid feeds and formula errors are not reported as valid standings", () => {
    for (const body of ["", "<html>Sign in</html>", "Team,Points", "Teams,Score\nTeam,#REF!", "Teams,Score\n#N/A,", "Teams,Score\nTeam,NaN", "Teams,Score\nTeam,2junk", 'Teams,Score\nTeam,"1,2"']) {
        assert.throws(() => parseStandings(body), body);
    }
});

test("the request uses only the second tab and does not send credentials", async () => {
    const controller = new AbortController();
    const result = await fetchStandings({ signal: controller.signal, fetcher: async (url, options) => {
        assert.equal(url, standingsUrl);
        assert.equal(new URL(url).searchParams.get("gid"), "857309");
        assert.equal(options.credentials, "omit");
        assert.equal(options.cache, "no-store");
        assert.equal(options.signal, controller.signal);
        return { ok: true, text: async () => "Teams,Score\nOrbit,5" };
    } });
    assert.equal(result.teams[0].score, 5);
    await assert.rejects(fetchStandings({ fetcher: async () => ({ ok: false, status: 403 }) }));
});

test("registration switches after September 29 ends in Eastern time", () => {
    assert.equal(registrationClosesAt, Date.parse("2026-09-30T04:00:00Z"));
    assert.equal(registrationState(registrationClosesAt - 1).url, registrationUrls.registration);
    assert.equal(registrationState(registrationClosesAt).url, registrationUrls.waitlist);
    assert.equal(registrationState(registrationClosesAt + 1).label, "Join the waitlist");
});

test("registration countdown handles days, final hours and the waitlist cutoff", () => {
    for (const [remaining, ending] of [
        [3 * 86_400_000, "2 days"], [86_400_000, "24 hours"],
        [2 * 3_600_000, "2 hours"], [3_600_000, "1 hour"],
        [120_000, "2 minutes"], [60_000, "1 minute"], [1, "less than a minute"],
    ]) {
        assert.equal(registrationCountdown(registrationClosesAt - remaining), `Registration closes in ${ending}`);
    }
    assert.equal(registrationCountdown(registrationClosesAt), "Registration closed. Waitlist open.");
    assert.equal(registrationCountdown(registrationClosesAt + 1000), "Registration closed. Waitlist open.");
});

test("countdown uses September 29 calendar days in Eastern time", () => {
    for (const [now, days] of [
        ["2026-09-26T00:00:00-04:00", 3],
        ["2026-09-26T23:59:59-04:00", 3],
        ["2026-09-27T03:59:59Z", 3],
        ["2026-09-27T04:00:00Z", 2],
        ["2026-09-28T12:00:00-04:00", 1],
    ]) {
        assert.equal(registrationCountdown(Date.parse(now)), `Registration closes in ${days} day${days === 1 ? "" : "s"}`);
    }
});

test("updated event details and public rooms match the new schedule", () => {
    assert.equal(events.estimathon.room, "Room 152");
    assert.equal(events["ai-ethics-panel"].title, "AI Panel Discussion");
    assert.match(events["chess-tournament"].time, /Saturday, October 10.*11:00 PM-12:00 AM/);
    assert.match(events["midnight-snack"].time, /12:00-7:00 AM/);
    assert.equal(scheduleRooms.sleep, "Rooms 161, 163, 164, 165, 166");
    assert.doesNotMatch(JSON.stringify({ events, scheduleRooms }), /organizer|HQ/i);
});
