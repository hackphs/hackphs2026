import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.TEST_SITE_URL || "http://localhost:3000";
const recapUrl = "/assets/videos/hackphs-2026-recap.mp4?v=20261013music";
let browser;
before(async () => { browser = await chromium.launch({ channel: "msedge", headless: true }); });
after(async () => {
    let timeout;
    try { await Promise.race([browser?.close(), new Promise(resolve => { timeout = setTimeout(resolve, 5000); })]); }
    finally { clearTimeout(timeout); }
});

test("recap welcomes once per session, plays, seeks, pauses on close and restores focus", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
        await page.goto(base);
        const dialog = page.locator("[data-recap-dialog]");
        await dialog.waitFor({ state: "visible" });
        const video = page.locator("[data-recap-video]");
        await page.waitForFunction(() => document.querySelector("[data-recap-video]").readyState >= 2);
        const metadata = await video.evaluate(element => ({ duration: element.duration, width: element.videoWidth, paused: element.paused, muted: element.muted, volume: element.volume }));
        assert.ok(metadata.duration > 218 && metadata.duration < 220);
        assert.equal(metadata.width, 792);
        assert.equal(metadata.muted, false);
        assert.equal(metadata.volume, 1);
        assert.equal(metadata.paused, true, "video does not autoplay");
        await dialog.screenshot({ path: join(process.cwd(), "tmp", "recap-desktop.png") });
        // A click grants playback permission, then the native media API tests playback.
        await video.click();
        await video.evaluate(element => element.play());
        await page.waitForFunction(() => document.querySelector("[data-recap-video]").currentTime > .1);
        await video.evaluate(element => { element.currentTime = 120; });
        await page.waitForFunction(() => {
            const element = document.querySelector("[data-recap-video]");
            return !element.seeking && element.currentTime >= 120;
        });
        await page.getByRole("button", { name: "Close recap", exact: true }).click();
        await dialog.waitFor({ state: "hidden" });
        assert.equal(await video.evaluate(element => element.paused), true);
        assert.equal(await page.locator("[data-recap-open]").evaluate(element => element === document.activeElement), true);
        await page.reload();
        await page.locator("[data-participant-map].is-interactive").waitFor();
        assert.equal(await dialog.isVisible(), false);
        assert.equal(await video.getAttribute("src"), null, "closed welcome does not load video bytes");
        await page.getByRole("link", { name: "Watch the 2026 recap", exact: true }).click();
        await dialog.waitFor({ state: "visible" });
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        await page.getByRole("link", { name: "Watch the 2026 recap", exact: true }).click();
        await page.mouse.click(2, 2);
        await dialog.waitFor({ state: "hidden" });
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});

test("recap deep link, error fallback and phone layout work", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    try {
        await page.addInitScript(() => sessionStorage.setItem("hackphs2026-recap-seen", "1"));
        await page.goto(`${base}/#recap`);
        const dialog = page.locator("[data-recap-dialog]");
        await dialog.waitFor({ state: "visible" });
        assert.equal(await dialog.evaluate(element => element.scrollWidth > element.clientWidth), false);
        await dialog.screenshot({ path: join(process.cwd(), "tmp", "recap-mobile.png") });
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        await page.goto(`${base}/?recap-error-check=1#schedule`);
        await page.locator("[data-participant-map].is-interactive").waitFor();
        assert.equal(await dialog.isVisible(), false, "anchor visits are not interrupted by welcome");
        await page.route("**/assets/videos/hackphs-2026-recap.mp4*", route => route.fulfill({ status: 404, body: "Not found" }));
        await page.getByRole("link", { name: "Watch the 2026 recap", exact: true }).click();
        await page.locator("[data-recap-error]").waitFor({ state: "visible" });
        assert.equal(await page.getByRole("link", { name: "Open video directly ↗" }).getAttribute("href"), recapUrl);
    } finally { await page.close(); }
});

test("team has two aligned directors and five approved groups with heads above organizers", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
        await page.goto(`${base}/team.html`);
        await page.locator(".team-group").first().waitFor();
        assert.equal(await page.locator(".team-director").count(), 2);
        assert.equal(await page.locator(".team-group").count(), 5);
        assert.equal(await page.getByRole("heading", { name: "Section Directors", exact: true }).count(), 5);
        assert.equal(await page.locator("[data-team-preview]").isVisible(), false);
        assert.deepEqual(await page.locator(".team-director h3").allTextContents(), ["Oscar Huang", "Alex Sheng"]);
        assert.deepEqual(await page.locator(".team-group > h3").allTextContents(), ["Finance", "Logistics", "Outreach", "Tech", "Design"]);
        assert.deepEqual(await page.locator('.team-group[aria-labelledby="finance-title"] .team-heads li').allTextContents(), ["Felix Yu", "Isaac Son"]);
        assert.equal(await page.locator(".team-organizers li").count(), 13);
        assert.match(await page.locator(".team-thanks").textContent(), /everyone who volunteered/);
        for (const width of [1280, 1024, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 960 });
            const positions = await page.locator(".team-director").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().y));
            assert.ok(Math.abs(positions[0] - positions[1]) < 1, "directors share a line");
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `team overflow at ${width}`);
            if (width === 1280 || width === 390) await page.screenshot({ path: join(process.cwd(), "tmp", `team-preview-${width}.png`), fullPage: true });
        }
        await page.evaluate(async () => {
            const { renderTeam } = await import("/scripts/team.js?v=20261013");
            const sample = {
                directors: [{ name: "Test Director Alpha" }, { name: "Test Director Beta" }],
                sections: Array.from({ length: 5 }, (_, index) => ({
                    id: `test-${index}`, name: `Test Section ${index}`, heads: ["Test Section Head"],
                    organizers: ["Test Organizer With A Very Long Name", "<img src=x onerror=alert(1)>"],
                })),
            };
            renderTeam(document.querySelector("[data-team-roster]"), sample);
        });
        assert.equal(await page.locator("[data-team-preview]").isVisible(), false);
        assert.equal(await page.locator(".team-group img").count(), 0);
        const first = page.locator(".team-group").first();
        assert.equal(await first.locator(".team-heads li").textContent(), "Test Section Head");
        assert.equal(await first.locator(".team-organizers li").count(), 2);
        assert.ok((await first.locator(".team-heads").boundingBox()).y < (await first.locator(".team-organizers").boundingBox()).y);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});

test("homepage navigation reaches team page and local server serves seekable byte ranges", async () => {
    const page = await browser.newPage();
    try {
        await page.goto(`${base}/#about`);
        assert.match(await page.locator(".about-fun-fact").textContent(), /one of the largest high-school-hosted hackathons internationally/);
        await page.getByRole("link", { name: "Meet the team", exact: true }).click();
        await page.locator(".team-group").first().waitFor();
        assert.equal(new URL(page.url()).pathname, "/team.html");
        const path = `${base}/assets/videos/hackphs-2026-recap.mp4`;
        const response = await page.request.get(path, { headers: { Range: "bytes=0-15" } });
        assert.equal(response.status(), 206);
        assert.equal((await response.body()).length, 16);
        assert.match(response.headers()["content-range"], /^bytes 0-15\//);
        const suffix = await page.request.get(path, { headers: { Range: "bytes=-16" } });
        assert.equal(suffix.status(), 206);
        assert.equal((await suffix.body()).length, 16);
        const invalid = await page.request.get(path, { headers: { Range: "bytes=999999999-" } });
        assert.equal(invalid.status(), 416);
        const head = await page.request.head(path);
        assert.equal(head.status(), 200);
        assert.equal(head.headers()["accept-ranges"], "bytes");
    } finally { await page.close(); }
});

test("approved team roster and direct video link remain available without JavaScript", async () => {
    const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    try {
        await page.goto(`${base}/team.html`);
        assert.deepEqual(await page.locator(".team-director h3").allTextContents(), ["Oscar Huang", "Alex Sheng"]);
        assert.equal(await page.locator(".team-group").count(), 5);
        assert.equal(await page.getByRole("heading", { name: "Section Directors", exact: true }).count(), 5);
        assert.deepEqual(await page.locator('.team-group[aria-labelledby="finance-static-title"] .team-heads li').allTextContents(), ["Felix Yu", "Isaac Son"]);
        assert.equal(await page.locator(".team-organizers li").count(), 13);
        await page.goto(base);
        assert.equal(await page.getByRole("link", { name: "Watch the 2026 recap", exact: true }).getAttribute("href"), recapUrl);
        assert.equal(await page.locator("[data-recap-dialog]").isVisible(), false);
    } finally { await page.close(); }
});
