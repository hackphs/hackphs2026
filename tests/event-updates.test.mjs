import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import { events, workshopEventSlugs, workshopSignupUrl, competitiveSignupUrls } from "../scripts/events.js";
import { signupOpensAt, signupsAreOpen } from "../scripts/event-signups.js";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.TEST_SITE_URL || "http://localhost:3000";
let browser;
before(async () => { browser = await chromium.launch({ channel: "msedge", headless: true }); });
after(async () => {
    let timeout;
    try {
        await Promise.race([browser?.close(), new Promise(resolve => { timeout = setTimeout(resolve, 5000); })]);
    } finally { clearTimeout(timeout); }
});

test("signup release is exactly 9 AM New York time on October 10", () => {
    assert.equal(new Date(signupOpensAt).toISOString(), "2026-10-10T13:00:00.000Z");
    assert.equal(signupsAreOpen(signupOpensAt - 1), false);
    assert.equal(signupsAreOpen(signupOpensAt), true);
    for (const slug of workshopEventSlugs) assert.equal(events[slug].signupUrl, workshopSignupUrl);
    assert.equal(Object.keys(competitiveSignupUrls).length, 6);
    for (const url of Object.values(competitiveSignupUrls)) assert.match(url, /^https:\/\/docs\.google\.com\/forms\/d\/(e\/)?[^/]+\/viewform$/);
    assert.equal(events["intro-to-swift-and-swiftui"], undefined);
    for (const slug of ["intro-to-google-ai-studio", "hacking-with-github-copilot", "techtogether-meetup"]) assert.equal(events[slug].room, "Room 152");
});

test("open workshop dialog updates at the release without reloading", async () => {
    const page = await browser.newPage({ reducedMotion: "reduce", timezoneId: "America/Los_Angeles" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
        await page.clock.install({ time: new Date(signupOpensAt - 3_600_000) });
        await page.goto(base);
        await page.locator('.schedule-table [data-event="intro-to-python"] a').click();
        await page.clock.pauseAt(new Date(signupOpensAt - 1000));
        const signup = page.locator('[data-event-dialog] [data-event-signup]');
        assert.match(await signup.textContent(), /Opens Saturday/);
        assert.equal(await signup.locator("a").count(), 0);
        assert.match(await page.locator("[data-signup-notice]").textContent(), /9:00 AM/);
        await page.clock.runFor(1000);
        assert.equal(await signup.locator("a").getAttribute("href"), workshopSignupUrl);
        assert.match(await page.locator("[data-signup-notice]").textContent(), /are open/);
        await page.keyboard.press("Escape");
        await page.clock.runFor(500);
        for (const [slug, url] of Object.entries(competitiveSignupUrls)) {
            // The frozen clock also pauses animation frames; use the real DOM click
            // handler for these link-routing checks instead of a physical mouse click.
            await page.locator(`.schedule-table [data-event="${slug}"] a`).last().evaluate(element => element.click());
            assert.equal(await signup.locator("a").getAttribute("href"), url);
            await page.keyboard.press("Escape");
            await page.clock.runFor(500);
        }
        assert.equal(await page.locator('[data-event="intro-to-swift-and-swiftui"]').count(), 0);
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});

test("standalone events use the same timed responder links", async () => {
    const page = await browser.newPage();
    try {
        await page.clock.install({ time: new Date(signupOpensAt - 3_600_000) });
        await page.goto(`${base}/events.html?event=intro-to-google-ai-studio`);
        await page.clock.pauseAt(new Date(signupOpensAt - 1000));
        assert.equal(await page.locator("[data-event-signup] a").count(), 0);
        await page.clock.runFor(1000);
        assert.equal(await page.locator("[data-event-signup] a").getAttribute("href"), workshopSignupUrl);
        await page.goto(`${base}/events.html?event=data-analytics-with-python`);
        assert.equal(await page.locator("[data-event-signup] a").getAttribute("href"), competitiveSignupUrls["data-analytics-with-python"]);
    } finally { await page.close(); }
});

test("map zoom, drag, keyboard, full screen and prize feature work on desktop and mobile", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
        await page.goto(base);
        const map = page.locator("[data-participant-map]");
        const viewport = page.locator("[data-map-viewport]");
        await map.scrollIntoViewIfNeeded();
        await map.locator("img").evaluate(image => image.decode());
        assert.equal(await map.locator("#participant-map-title").count(), 0, "heading is outside the viewer");
        assert.equal(await map.evaluate(element => getComputedStyle(element).backgroundColor), "rgba(0, 0, 0, 0)");
        const assertMapInsets = async () => {
            const bounds = await viewport.boundingBox();
            const imageBounds = await page.locator("[data-map-image]").boundingBox();
            const top = imageBounds.y - bounds.y;
            const bottom = bounds.y + bounds.height - imageBounds.y - imageBounds.height;
            assert.ok(top >= 16, "map has clear space above it");
            assert.ok(Math.abs(top - bottom) < 2, "map is vertically centered with equal insets");
        };
        await assertMapInsets();
        assert.equal((await page.request.get(`${base}/assets/documents/hackphs-2026-participant-map.pdf`)).status(), 200);
        await page.getByRole("button", { name: "Zoom in", exact: true }).click();
        assert.equal(await page.locator("[data-map-zoom]").textContent(), "125%");
        const box = await viewport.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30);
        await page.mouse.up();
        assert.match(await page.locator("[data-map-image]").getAttribute("style"), /translate\(50px, 30px\)/);
        await viewport.focus();
        await page.keyboard.press("Home");
        assert.equal(await page.locator("[data-map-zoom]").textContent(), "100%");
        await page.getByRole("button", { name: "Full screen", exact: true }).click();
        await page.getByRole("button", { name: "Exit full screen", exact: true }).waitFor();
        await page.getByRole("button", { name: "Exit full screen", exact: true }).click();
        await page.getByRole("button", { name: "Full screen", exact: true }).waitFor();
        await page.locator("#participant-map").screenshot({ path: join(process.cwd(), "tmp", "map-desktop.png") });
        const drone = page.getByRole("button", { name: "Tilt the drone grand prize preview" });
        await drone.scrollIntoViewIfNeeded();
        await drone.locator("img").evaluate(image => image.decode());
        await drone.focus();
        await page.keyboard.press("ArrowRight");
        assert.equal(await drone.evaluate(element => element.style.getPropertyValue("--tilt-y")), "6deg");
        const competitive = await page.locator(".prize-competitive").innerText();
        assert.match(competitive, /Neon UFO LED sign/);
        assert.match(competitive, /Wireless earbuds/);
        assert.doesNotMatch(competitive, /Monitor light|Plushie/);
        assert.equal(await page.locator(".prize-raffles__more li").count(), 6);
        await page.locator(".prize-raffles").screenshot({ path: join(process.cwd(), "tmp", "raffles-desktop.png") });
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            await map.scrollIntoViewIfNeeded();
            await page.getByRole("button", { name: "Zoom in", exact: true }).click();
            assert.equal(await page.locator("[data-map-zoom]").textContent(), "125%");
            await page.getByRole("button", { name: "Reset map", exact: true }).click();
            await assertMapInsets();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        }
        await page.locator("#participant-map").screenshot({ path: join(process.cwd(), "tmp", "map-mobile.png") });
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});

test("map supports touch pinch and clamps zoom to 100–400 percent", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
    try {
        await page.goto(base);
        const viewport = page.locator("[data-map-viewport]");
        await viewport.scrollIntoViewIfNeeded();
        const box = await viewport.boundingBox();
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        const session = await page.context().newCDPSession(page);
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx - 30, y: cy }, { x: cx + 30, y: cy }] });
        await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx - 60, y: cy }, { x: cx + 60, y: cy }] });
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        assert.equal(await page.locator("[data-map-zoom]").textContent(), "200%");
        for (let i = 0; i < 10; i++) await viewport.press("+");
        assert.equal(await page.locator("[data-map-zoom]").textContent(), "400%");
        assert.equal(await page.getByRole("button", { name: "Zoom in", exact: true }).isDisabled(), true);
        for (let i = 0; i < 10; i++) await viewport.press("-");
        assert.equal(await page.locator("[data-map-zoom]").textContent(), "100%");
        assert.equal(await page.getByRole("button", { name: "Zoom out", exact: true }).isDisabled(), true);
    } finally { await page.close(); }
});
