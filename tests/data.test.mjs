import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseStandings, fetchStandings, standingsUrl } from "../scripts/leaderboard-data.js";
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

test("updated event details and public rooms match the new schedule", () => {
    assert.equal(events.estimathon.room, "Room 152");
    assert.equal(events["ai-ethics-panel"].title, "AI Panel Discussion");
    assert.match(events["chess-tournament"].time, /Saturday, October 10.*11:00 PM-12:00 AM/);
    assert.match(events["midnight-snack"].time, /12:30-7:00 AM/);
    assert.equal(scheduleRooms.sleep, "Boys: Rooms 161, 163, 165, 143\nGirls: Rooms 142, 144, 146");
    assert.equal(scheduleRooms["check-in begins"], "New Gym");
    assert.equal(scheduleRooms["opening ceremony"], "New Gym");
    assert.equal(scheduleRooms["closing ceremony"], "New Gym");
    assert.match(events["elad-hazan"].time, /11:30 AM-12:30 PM/);
});
