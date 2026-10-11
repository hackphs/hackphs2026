import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = new URL("../", import.meta.url);

test("judge flow, live refresh, retries, ranking, and mobile layout", async () => {
    const browser = await chromium.launch({ channel: process.env.TEST_BROWSER || "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const names = ["AI-Driven Recycle Decision Maker", "Landslides Susceptibility Classifier", "Flame Finder", "Better Gator", "Carbon Calculator"];
    const sets = [{ id: "Set 1", complete: false, ranking: [], projects: names.map((name, i) => ({ id: "p" + i, name, table: String(i + 1) })) }];
    const scores = [];
    let failSave = false;
    let configs = 0;
    let assignmentMessage = "";
    const snapshot = () => ({ ok: true, version: "tablesets-v2", judge: { name: "Judge A" }, tablesets: sets, scores, assignmentMessage });
    try {
        await page.clock.install();
        await page.route("**/*", async (route) => {
            const url = new URL(route.request().url());
            if (url.hostname === "script.google.com") {
                const req = route.request().postDataJSON();
                assert.equal(req.invitation, "Invitation");
                let result;
                if (req.action === "submit") {
                    if (failSave) result = { ok: false, error: "Temporary connection error" };
                    else {
                        const weights = { innovation: .25, functionality: .3, creativity: .25, theme: .1, technical: .1 };
                        const total = Math.round(Object.entries(weights).reduce((sum, [key, weight]) => sum + weight * req.entry.scores[key] * 4, 0) * 100) / 100;
                        const entry = { ...req.entry, id: JSON.stringify([req.entry.tableset, req.entry.project]), total };
                        const index = scores.findIndex((s) => s.id === entry.id);
                        if (index < 0) scores.push(entry); else scores[index] = entry;
                        result = { ok: true, entry };
                    }
                } else if (req.action === "complete") {
                    const set = sets.find((s) => s.id === req.tableset);
                    set.ranking = req.ranking;
                    set.complete = true;
                    result = snapshot();
                } else if (req.action === "claim") {
                    if (sets.length === 1) sets.push({ id: "Set 2", complete: false, ranking: [], projects: [{ id: "new", name: "New Project", table: "6" }] });
                    result = snapshot();
                } else { configs++; result = snapshot(); }
                return route.fulfill({ contentType: "application/json", body: JSON.stringify(result), headers: { "Access-Control-Allow-Origin": "*" } });
            }
            if (url.hostname === "judging.test") {
                const path = url.pathname === "/judging/" ? "judging/index.html" : url.pathname.slice(1);
                try {
                    return route.fulfill({ contentType: path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : path.endsWith(".svg") ? "image/svg+xml" : "text/html", body: readFileSync(new URL(path, root)) });
                } catch { return route.fulfill({ status: 404, body: "" }); }
            }
            return route.abort();
        });
        await page.goto("http://judging.test/judging/");
        await page.locator('[name="name"]').fill("Judge A");
        await page.locator('[name="invitation"]').fill("Invitation");
        await page.getByRole("button", { name: "Start judging" }).click();
        await page.locator('[data-view="app"]').waitFor({ state: "visible" });
        assert.equal(await page.locator('[data-project]').count(), 5);
        const score = async (value = 8) => {
            for (const key of ["innovation", "functionality", "creativity", "theme", "technical"]) {
                await page.locator('input[name="' + key + '"][value="' + value + '"]').check();
            }
        };
        await score();
        await page.locator('[name="notes"]').fill("Keep my draft");
        const prior = configs;
        sets[0].projects[0].name = "Renamed Project";
        sets[0].projects[0].table = "99";
        await page.clock.fastForward(31000);
        await page.getByRole("option", { name: "Renamed Project - Table 99", exact: true }).waitFor({ state: "attached" });
        assert.ok(configs > prior);
        assert.equal(await page.locator('[name="notes"]').inputValue(), "Keep my draft");
        assert.equal(await page.locator('input[name="innovation"][value="8"]').isChecked(), true);
        assert.equal(await page.getByRole("button", { name: "Finish tableset" }).isDisabled(), true);
        failSave = true;
        await page.getByRole("button", { name: "Submit score" }).click();
        await page.locator('[data-score-feedback]').filter({ hasText: "Your draft remains" }).waitFor();
        assert.equal(scores.length, 0);
        failSave = false;
        await page.getByRole("button", { name: "Submit score" }).click();
        await page.locator('[data-score-feedback]').filter({ hasText: "Score saved" }).waitFor();
        for (let i = 1; i < 5; i++) {
            await page.locator('[data-project="p' + i + '"]').click();
            assert.equal(await page.locator('input[name="innovation"][value="8"]').isChecked(), false);
            await score();
            await page.getByRole("button", { name: "Submit score" }).click();
            await page.locator('[data-score-feedback]').filter({ hasText: "Score saved" }).waitFor();
        }
        assert.equal(scores.length, 5);
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.equal(await page.getByRole("table", { name: "Tableset ranking" }).count(), 1);
        for (let i = 0; i < 5; i++) await page.locator('[name="place' + i + '"]').selectOption("p0");
        await page.getByRole("button", { name: "Finish tableset" }).click();
        await page.locator('[data-ranking-feedback]').filter({ hasText: "exactly once" }).waitFor();
        for (let i = 0; i < 5; i++) await page.locator('[name="place' + i + '"]').selectOption("p" + i);
        scores[0].notes = "Updated remotely";
        await page.clock.fastForward(31000);
        await page.waitForFunction(() => document.querySelector('[data-sync]').textContent === "Connected");
        for (let i = 0; i < 5; i++) assert.equal(await page.locator('[name="place' + i + '"]').inputValue(), "p" + i);
        // Distinct saved totals must fill every place without any manual selection.
        for (const [id, value] of [["p4", 12], ["p0", 11], ["p1", 10], ["p2", 9]]) {
            await page.locator('[data-project="' + id + '"]').click();
            await score(value);
            assert.equal(await page.getByRole("button", { name: "Finish tableset" }).isDisabled(), true);
            await page.getByRole("button", { name: "Submit score" }).click();
            await page.locator('[data-score-feedback]').filter({ hasText: "Score saved" }).waitFor();
        }
        const expected = ["p4", "p0", "p1", "p2", "p3"];
        assert.equal(await page.locator('[data-ranking-fields] select').count(), 0);
        for (let i = 0; i < 5; i++) assert.equal(await page.locator('[name="place' + i + '"]').inputValue(), expected[i]);
        assert.deepEqual(await page.locator('.ranking-points').allTextContents(), ["15", "10", "5", "0", "0"]);
        assert.equal(await page.locator('.ranking-table tbody tr').count(), 5);
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.locator('[data-ranking]').screenshot({ path: "/tmp/hackphs-ranking-desktop.png" });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.locator('[data-ranking]').screenshot({ path: "/tmp/hackphs-ranking-mobile.png" });
        await page.setViewportSize({ width: 320, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        page.on("dialog", (dialog) => dialog.accept());
        await page.getByRole("button", { name: "Finish tableset" }).click();
        await page.getByRole("button", { name: "Get another tableset" }).waitFor({ state: "visible" });
        assert.deepEqual(sets[0].ranking, expected);
        await page.getByRole("button", { name: "Get another tableset" }).click();
        await page.locator('[data-project="new"]').waitFor();
        assert.equal(await page.locator('[data-project]').count(), 1);
        await score(6);
        await page.getByRole("button", { name: "Submit score" }).click();
        await page.locator('[data-score-feedback]').filter({ hasText: "Score saved" }).waitFor();
        assert.equal(await page.locator('[name="place0"]').inputValue(), "new");
        await page.getByRole("button", { name: "Finish tableset" }).click();
        await page.getByRole("button", { name: "Get another tableset" }).waitFor({ state: "visible" });
        assignmentMessage = "Every project has three completed reviews. Thank you!";
        await page.clock.runFor(31000);
        await page.getByText("Every project has 3 completed reviews. Thank you so much for being at HackPHS this year, Judge A, and thank you so much for your time.", { exact: true }).waitFor();
        assert.equal(await page.getByRole("button", { name: "Get another tableset" }).isVisible(), false);
        assert.deepEqual(errors, []);
        await page.getByRole("button", { name: "Sign out" }).click();
        await page.locator('[data-view="signin"]').waitFor({ state: "visible" });
        assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes("Invitation")), false);
    } finally { await browser.close(); }
});
