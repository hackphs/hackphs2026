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
    const sets = [{ id: "Set 1", complete: false, ranking: [], projects: Array.from({ length: 5 }, (_, i) => ({ id: "p" + i, name: "Project " + i, table: String(i + 1) })) }];
    const scores = [];
    let failSave = false;
    let configs = 0;
    const snapshot = () => ({ ok: true, version: "tablesets-v1", judge: { name: "Judge A" }, tablesets: sets, scores });
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
                        const entry = { ...req.entry, id: JSON.stringify([req.entry.tableset, req.entry.project]), total: 32 };
                        const index = scores.findIndex((s) => s.id === entry.id);
                        if (index < 0) scores.push(entry); else scores[index] = entry;
                        result = { ok: true, entry };
                    }
                } else if (req.action === "complete") {
                    sets[0].ranking = req.ranking;
                    sets[0].complete = true;
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
        const score = async () => {
            for (const key of ["innovation", "functionality", "creativity", "theme", "technical"]) {
                await page.locator('input[name="' + key + '"][value="8"]').check();
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
        for (let i = 0; i < 5; i++) await page.locator('[name="place' + i + '"]').selectOption("p0");
        await page.getByRole("button", { name: "Finish tableset" }).click();
        await page.locator('[data-ranking-feedback]').filter({ hasText: "exactly once" }).waitFor();
        for (let i = 0; i < 5; i++) await page.locator('[name="place' + i + '"]').selectOption("p" + i);
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: "/tmp/hackphs-judging-tablesets-mobile.png", fullPage: true });
        page.on("dialog", (dialog) => dialog.accept());
        await page.getByRole("button", { name: "Finish tableset" }).click();
        await page.getByRole("button", { name: "Get another tableset" }).waitFor({ state: "visible" });
        await page.getByRole("button", { name: "Get another tableset" }).click();
        await page.locator('[data-project="new"]').waitFor();
        assert.equal(await page.locator('[data-project]').count(), 1);
        assert.deepEqual(errors, []);
        await page.getByRole("button", { name: "Sign out" }).click();
        await page.locator('[data-view="signin"]').waitFor({ state: "visible" });
        assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes("Invitation")), false);
    } finally { await browser.close(); }
});
