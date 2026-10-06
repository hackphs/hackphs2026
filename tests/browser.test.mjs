import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.TEST_SITE_URL || "http://localhost:3000";
const feed = "**/spreadsheets/d/1_r2inZiMa1JkOqW5_fbz8bgn4ONDuzpWf_T1qAirirg/gviz/**";
let browser;

before(async () => { browser = await chromium.launch({ channel: "msedge", headless: true }); });
after(async () => { await browser?.close(); });

async function pageForTest(width = 1440) {
    const page = await browser.newPage({ viewport: { width, height: 960 }, reducedMotion: "reduce" });
    page.errors = [];
    page.on("pageerror", (error) => page.errors.push(error.message));
    return page;
}

test("live public sheet connects without signing in", async () => {
    const page = await pageForTest();
    try {
        await page.goto(`${base}/leaderboard.html`);
        await page.locator('[data-score-status][data-state="connected"]').waitFor({ timeout: 25000 });
        assert.deepEqual(page.errors, []);
        await page.screenshot({ path: join(tmpdir(), "hackphs-leaderboard-empty.png"), fullPage: true });
    } finally { await page.close(); }
});

test("leaderboard refreshes, handles ties, retains stale scores and recovers", async () => {
    const page = await pageForTest();
    let csv = 'Teams,Score\n"Sky, ""High""",20\nOrbit,20\nZero,0\n<img src=x onerror=alert(1)>,0\nExtra,-5';
    let failure = false;
    let requests = 0;
    try {
        await page.clock.install();
        await page.route(feed, async (route) => {
            requests++;
            await route.fulfill({ status: failure ? 503 : 200, contentType: "text/csv", body: csv });
        });
        await page.goto(`${base}/leaderboard.html`);
        await page.locator('[data-score-status][data-state="connected"]').waitFor();
        assert.deepEqual(await page.locator("[data-standings] td:first-child").allTextContents(), ["5"]);
        assert.equal(await page.locator('.podium-place[data-place="1"] .podium-team-name').first().textContent(), 'Sky, "High"');
        assert.equal(await page.locator("[data-standings] img, [data-podium] img").count(), 0);
        await page.screenshot({ path: join(tmpdir(), "hackphs-leaderboard-desktop.png"), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: join(tmpdir(), "hackphs-leaderboard-mobile.png"), fullPage: true });

        csv = "Teams,Score\nOrbit,30\nSky High,20\nThird,10\nFourth,5\nFifth,0";
        const previousRequests = requests;
        await page.clock.fastForward(30000);
        await page.waitForFunction(() => document.querySelector('.podium-place[data-place="1"] .podium-team-name')?.textContent === "Orbit");
        assert.ok(requests > previousRequests);

        failure = true;
        await page.getByRole("button", { name: "Refresh", exact: true }).click();
        await page.locator('[data-score-status][data-state="offline"]').waitFor();
        assert.equal(await page.locator("[data-standings] tr").count(), 2);
        assert.match(await page.locator("[data-score-message]").textContent(), /not live scores/);
        assert.ok(await page.locator("[data-score-updated]").getAttribute("datetime"));

        failure = false;
        csv = "Teams,Score";
        await page.getByRole("button", { name: "Refresh", exact: true }).click();
        await page.locator('[data-score-status][data-state="connected"]').waitFor();
        assert.equal(await page.locator("[data-standings-table]").isVisible(), false);
        assert.match(await page.locator("[data-score-message]").textContent(), /first scores/);
        assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
});

test("initial feed error shows an error, not an empty leaderboard", async () => {
    const page = await pageForTest();
    try {
        await page.route(feed, (route) => route.fulfill({ contentType: "text/html", body: "<html>Sign in</html>" }));
        await page.goto(`${base}/leaderboard.html`);
        await page.locator('[data-score-status][data-state="offline"]').waitFor();
        assert.match(await page.locator("[data-score-message]").textContent(), /couldn't load/);
        assert.equal(await page.locator("[data-standings-table]").isVisible(), false);
    } finally { await page.close(); }
});

test("podium follows rankings, shares ties and handles fewer than three teams", async () => {
    const page = await pageForTest();
    let csv = "Teams,Score\nOrbit,55\nComets,50\nSky High,35\nLaunchpad,20";
    try {
        await page.route(feed, (route) => route.fulfill({ contentType: "text/csv", body: csv }));
        await page.goto(`${base}/leaderboard.html`);
        await page.locator('[data-score-status][data-state="connected"]').waitFor();
        const first = page.locator('.podium-place[data-place="1"]');
        const second = page.locator('.podium-place[data-place="2"]');
        const third = page.locator('.podium-place[data-place="3"]');
        assert.equal(await first.locator(".podium-team-name").textContent(), "Orbit");
        assert.equal(await second.locator(".podium-team-name").textContent(), "Comets");
        assert.equal(await third.locator(".podium-team-name").textContent(), "Sky High");
        assert.equal(await page.locator("[data-standings] tr").count(), 1);
        assert.deepEqual(await page.locator(".podium-medal").allTextContents(), ["1", "2", "3"]);
        assert.equal(await page.locator(".podium-ribbon").count(), 3);
        assert.notEqual(await first.locator(".podium-teams").evaluate((element) => getComputedStyle(element, "::before").content), "none");
        assert.equal(await page.locator("[data-standings] th").textContent(), "Launchpad");
        assert.equal(await page.locator("[data-standings] td").first().textContent(), "4");
        const firstBox = await first.locator(".podium-step").boundingBox();
        const secondBox = await second.locator(".podium-step").boundingBox();
        const thirdBox = await third.locator(".podium-step").boundingBox();
        assert.ok(secondBox.x < firstBox.x && firstBox.x < thirdBox.x);
        assert.ok(firstBox.height > secondBox.height && secondBox.height > thirdBox.height);
        await page.screenshot({ path: join(tmpdir(), "hackphs-podium-desktop.png"), fullPage: true });
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await page.screenshot({ path: join(tmpdir(), `hackphs-podium-${width}.png`), fullPage: true });
        }

        csv = "Teams,Score\nComets,60\nOrbit,55\nSky High,35";
        await page.getByRole("button", { name: "Refresh", exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.podium-place[data-place="1"] .podium-team-name')?.textContent === "Comets");
        csv = "Teams,Score\nComets,60\nOrbit,60\nSky High,35";
        await page.getByRole("button", { name: "Refresh", exact: true }).click();
        await page.locator(".podium-tie").waitFor();
        assert.equal(await first.locator(".podium-team-name").count(), 2);
        assert.equal(await second.locator(".podium-team-name").count(), 0);
        assert.equal(await third.locator(".podium-team-name").textContent(), "Sky High");

        assert.equal(await page.locator("[data-standings-table]").isVisible(), false);

        csv = "Teams,Score\nSolo,0";
        await page.getByRole("button", { name: "Refresh", exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.podium-place[data-place="1"] .podium-team-name')?.textContent === "Solo");
        assert.match(await first.locator(".podium-score").textContent(), /^0 points$/);
        assert.equal(await page.locator(".podium-place.is-empty").count(), 2);
        assert.equal(await page.locator("[data-standings-table]").isVisible(), false);
        csv = "Teams,Score";
        await page.getByRole("button", { name: "Refresh", exact: true }).click();
        await page.locator("[data-podium]").waitFor({ state: "hidden" });
        assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
});

test("leaderboard typography keeps long team names readable on small screens", async () => {
    const page = await pageForTest();
    try {
        await page.route(feed, (route) => route.fulfill({
            contentType: "text/csv",
            body: "Teams,Score\nThe After School Astronauts,1200\nAnExtremelyLongUnbrokenTeamName,1200\nComets,800\nAnother Long Team Name,500",
        }));
        await page.goto(`${base}/leaderboard.html`);
        await page.locator('[data-score-status][data-state="connected"]').waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.match(await page.locator("h1").evaluate((element) => getComputedStyle(element).fontFamily), /Barlow Condensed/);
        assert.match(await page.locator(".podium-team-name").first().evaluate((element) => getComputedStyle(element).fontFamily), /Source Sans 3/);
        for (const width of [1440, 390, 320]) {
            await page.setViewportSize({ width, height: 960 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            assert.ok(await page.locator(".podium-team-name").evaluateAll((elements) =>
                elements.every((element) => element.scrollWidth <= element.clientWidth)
            ));
        }
        assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
});

test("new sponsor logos load and PREA has a transparent background", async () => {
    const page = await pageForTest();
    try {
        await page.goto(base);
        const field = page.locator(".sponsor-field");
        await field.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => getComputedStyle(document.querySelector(".sponsor-field")).opacity === "1");
        for (const name of ["pjs-pancake-house.png", "andymark.png", "chick-fil-a.svg", "pcbway.svg", "prea.png", "phs-pto.png", "xyz.png", "texas-instruments.png", "openmv.png", "small-world-coffee.svg", "pnc.png", "hotbirds.png"]) {
            const logo = page.locator(`#sponsors img[src*='/${name}']`);
            await logo.scrollIntoViewIfNeeded();
            await logo.evaluate((image) => image.decode());
            assert.ok(await logo.evaluate((image) => image.naturalWidth > 0));
        }
        assert.equal(await page.locator(".sponsor-featured > a, .sponsor-featured > div").count(), 4);
        const featuredCenters = await page.locator(".sponsor-featured > a").evaluateAll((links) => links.map((link) => {
            const bounds = link.getBoundingClientRect();
            return bounds.y + bounds.height / 2;
        }));
        assert.ok(Math.max(...featuredCenters) - Math.min(...featuredCenters) < 1, "four featured sponsors align in one row");
        assert.equal(await page.locator('#sponsors img[src*="mlh.png"]').count(), 0);
        assert.equal(await page.locator("#mlh-trust-badge").count(), 1);
        const prea = page.locator(".sponsor-featured__prea img");
        assert.equal(await page.locator(".sponsor-featured__prea").getAttribute("href"), "https://pressa-nj.org/");
        const burger = page.locator(".sponsor-featured__burgerrunn img");
        assert.equal(Math.round((await prea.boundingBox()).width), Math.round((await burger.boundingBox()).width));
        const alpha = await prea.evaluate((image) => {
            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let transparent = 0;
            let opaqueWhite = 0;
            for (let index = 0; index < pixels.length; index += 4) {
                if (pixels[index + 3] === 0) transparent++;
                if (pixels[index + 3] >= 250 && pixels[index] > 245 && pixels[index + 1] > 245 && pixels[index + 2] > 245) opaqueWhite++;
            }
            return { corner: pixels[3], transparent, opaqueWhite };
        });
        assert.equal(alpha.corner, 0);
        assert.ok(alpha.transparent > 10000);
        assert.ok(alpha.opaqueWhite > 10000, "white pi symbol remains opaque");
        await field.screenshot({ path: join(tmpdir(), "hackphs-sponsors-desktop.png") });
        await page.setViewportSize({ width: 390, height: 844 });
        await field.screenshot({ path: join(tmpdir(), "hackphs-sponsors-mobile.png") });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
});

test("waitlist bar appears past the hero and clears the badge", async () => {
    const page = await pageForTest();
    try {
        await page.clock.install({ time: new Date("2026-09-26T04:00:00Z") });
        await page.goto(base);
        const bar = page.locator("[data-registration-bar]");
        await bar.locator("img").evaluate((image) => image.decode());
        assert.equal(await bar.getByRole("link", { name: "Bring your waiver", includeHidden: true }).getAttribute("href"), "#waiver");
        assert.equal(await page.locator('a[href="https://forms.gle/xHiPQQyVb7PakdKs5"]').count(), 0);
        assert.match(await bar.textContent(), /Waitlist open/);
        assert.equal(await bar.isVisible(), false);
        assert.equal(await bar.evaluate((element) => element.inert), true);
        for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 960 });
            await page.locator("#about").evaluate((element) => window.scrollTo({ top: element.offsetTop + 20, behavior: "instant" }));
            await bar.waitFor({ state: "visible" });
            assert.equal(await bar.evaluate((element) => element.inert), false);
            const badge = await page.locator("#mlh-trust-badge").boundingBox();
            for (const element of await bar.locator("p, .registration-bar__link, .registration-bar__merch, img").all()) {
                const box = await element.boundingBox();
                assert.ok(box.x + box.width <= badge.x, `badge overlap at ${width}`);
            }
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await page.waitForTimeout(800);
            await page.screenshot({ path: join(tmpdir(), `hackphs-registration-bar-${width}.png`) });
        }
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await bar.waitFor({ state: "hidden" });
        assert.equal(await bar.locator("[data-registration-link]").textContent(), "Join the waitlist");
        assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
});

test("waitlist links work without JavaScript", async () => {
    const page = await browser.newPage({ javaScriptEnabled: false });
    try {
        await page.goto(base);
        const links = page.locator("[data-registration-link]");
        assert.equal(await links.count(), 3);
        for (const link of await links.all()) {
            assert.ok((await link.getAttribute("href")).includes("1FAIpQLSfN_dE_l8"));
        }
        assert.match(await page.locator(".primary-action").textContent(), /Join the waitlist/);
    } finally { await page.close(); }
});

test("prizes keep every award and the image controls work across layouts", async () => {
    const page = await pageForTest();
    try {
        await page.goto(base);
        await page.locator(".prize-podium").scrollIntoViewIfNeeded();
        const prizes = page.locator("#prizes");
        const copy = await prizes.innerText();
        for (const detail of ["$600", "$350", "$100", "3 months of ElevenLabs Pro", "NordVPN Prime", "NordPass Premium", "NordProtect/Coveron", "Incogni", "1 GB of Saily", "€200", "Four $25 AoPS coupons", "$1,000 scholarship", "2 years of Windscribe Pro", "4 years of TI-84", "3 months of Codeset Fellow", "3 months of Scale", "1.8 million credits/month", "3 years of Windscribe", "$1,200 per year", "1 month of Codeset Learner", "5,000 credits", "1 month of ElevenLabs Creator", "HRT shirts", "PREA frisbees", "MLH swag"]) {
            assert.ok(copy.includes(detail), `missing prize detail: ${detail}`);
        }
        assert.equal(await prizes.locator(".prize-place__note").count(), 3);
        assert.equal(await prizes.locator(".prize-place .prize-extras").count(), 0);
        assert.equal(await prizes.locator(".prize-extras li").count(), 5);
        for (const image of await prizes.locator(".prize-preview img").all()) await image.evaluate((image) => image.decode());

        const monitor = page.getByRole("button", { name: "Tilt the gaming monitor preview" });
        await monitor.focus();
        await page.keyboard.press("ArrowRight");
        assert.equal(await monitor.evaluate((element) => element.style.getPropertyValue("--tilt-y")), "6deg");
        await page.keyboard.press("Home");
        assert.equal(await monitor.evaluate((element) => element.style.getPropertyValue("--tilt-y")), "0deg");
        const box = await monitor.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2, { steps: 5 });
        await page.mouse.up();
        assert.ok(Number.parseFloat(await monitor.evaluate((element) => element.style.getPropertyValue("--tilt-y"))) > 0);

        const first = await page.locator(".prize-place--first").boundingBox();
        const second = await page.locator(".prize-place--second").boundingBox();
        assert.ok(first.x < second.x && first.height > second.height);
        for (const width of [980, 768, 560, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `prize overflow at ${width}`);
            for (const block of await prizes.locator(".prize-place, .prize-extras, .prize-shared, .prize-tracks, .prize-perks").all()) {
                const bounds = await block.boundingBox();
                assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
            }
        }
        assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
});

test("event popup accent matches the clicked category in both views and history", async () => {
    const page = await pageForTest();
    try {
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 960 });
            await page.goto(base);
            await page.locator(".schedule-block__room").first().waitFor({ state: "attached" });
            const view = width === 1440 ? ".schedule-table" : ".schedule-simple";
            for (const [name, category] of [["Estimathon", "Activities"], ["Intro to Python", "Workshops"], ["Karaoke", "Late Night"]]) {
                const link = page.locator(`${view} a`).filter({ hasText: name }).first();
                const tint = await link.evaluate((element) => getComputedStyle(element.closest(".schedule-block, .schedule-simple__event")).getPropertyValue("--block-tint").trim());
                const expected = `rgb(${tint.split(",").map((value) => value.trim()).join(", ")})`;
                await link.click();
                const dialog = page.locator("[data-event-dialog]");
                await dialog.waitFor();
                assert.equal(await dialog.evaluate((element) => getComputedStyle(element).borderTopColor), expected);
                assert.equal(await page.locator("[data-dialog-breadcrumb]").textContent(), `hackPHS / Schedule / ${category}`);
                await page.keyboard.press("Escape");
                await dialog.waitFor({ state: "hidden" });
                await page.waitForFunction(() => !history.state?.eventSlug);
                await page.goForward();
                await dialog.waitFor();
                assert.equal(await dialog.evaluate((element) => getComputedStyle(element).borderTopColor), expected);
                assert.equal(await page.locator("[data-dialog-breadcrumb]").textContent(), `hackPHS / Schedule / ${category}`);
                await page.keyboard.press("Escape");
                await dialog.waitFor({ state: "hidden" });
                await page.waitForFunction(() => !history.state?.eventSlug);
            }
        }
        assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
});

test("schedule preserves original text colors and sizes without covering the sky", async () => {
    const page = await pageForTest();
    try {
        await page.goto(base);
        await page.locator(".schedule-block__room").first().waitFor({ state: "attached" });
        assert.equal(await page.locator(".schedule-section").evaluate((element) => getComputedStyle(element).backgroundColor), "rgba(0, 0, 0, 0)");
        assert.equal(await page.locator(".schedule-section").evaluate((element) => getComputedStyle(element).backgroundImage), "none");
        const color = (selector, pseudo) => page.locator(selector).first().evaluate((element, pseudo) => getComputedStyle(element, pseudo).color, pseudo);
        assert.equal(await color(".schedule-section"), "rgb(10, 26, 49)");
        assert.equal(await color(".schedule-intro"), "rgba(8, 24, 47, 0.76)");
        assert.equal(await color(".schedule-block--milestone"), "rgb(22, 69, 47)");
        assert.equal(await color(".schedule-table__milestone > th"), "rgb(40, 105, 71)");
        assert.equal(await color(".schedule-block--milestone", "::before"), "rgb(39, 128, 81)");
        assert.equal(await color(".schedule-simple__stop--milestone .schedule-simple__time"), "rgb(40, 105, 71)");
        assert.equal(await color(".schedule-block small"), "rgba(8, 24, 47, 0.5)");
        assert.equal(await page.locator(".schedule-block small").first().evaluate((element) => getComputedStyle(element).fontSize), "9.6px");
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 960 });
            const selector = width === 1440 ? ".schedule-table__date" : ".schedule-simple__date";
            await page.locator(selector).first().evaluate((element) => window.scrollTo({ top: element.getBoundingClientRect().top + scrollY - 90, behavior: "instant" }));
            await page.waitForTimeout(750);
            await page.screenshot({ path: join(tmpdir(), `hackphs-schedule-readable-${width}.png`) });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        }
        assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
});

test("rocket avoids per-frame layout reads and pauses outside the hero", async () => {
    const page = await pageForTest();
    try {
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.addInitScript(() => {
            window.rocketSizeReads = 0;
            for (const name of ["clientWidth", "clientHeight", "offsetWidth", "offsetHeight"]) {
                const prototype = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name) ? HTMLElement.prototype : Element.prototype;
                const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
                Object.defineProperty(prototype, name, { ...descriptor, get() {
                    if (this.matches(".rocket-orbit, [data-rocket]")) window.rocketSizeReads++;
                    return descriptor.get.call(this);
                } });
            }
        });
        const session = await page.context().newCDPSession(page);
        await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await page.goto(base);
        await page.evaluate(() => document.fonts.ready);
        const rocket = page.locator("[data-rocket]");
        await page.waitForFunction(() => document.querySelector("[data-rocket]").style.opacity === "1");
        const initial = await rocket.getAttribute("style");
        await page.evaluate(() => { window.rocketSizeReads = 0; });
        await page.waitForTimeout(500);
        assert.notEqual(await rocket.getAttribute("style"), initial);
        assert.equal(await page.evaluate(() => window.rocketSizeReads), 0);

        await page.evaluate(() => window.scrollTo({ top: document.querySelector(".hero-section").offsetHeight + 100, behavior: "instant" }));
        await page.locator(".hero-section.is-motion-paused").waitFor({ state: "attached" });
        const paused = await rocket.getAttribute("style");
        await page.waitForTimeout(350);
        assert.equal(await rocket.getAttribute("style"), paused);
        assert.equal(await page.locator(".rocket-flame").evaluate((element) => getComputedStyle(element).animationPlayState), "paused");

        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.waitForFunction(() => !document.querySelector(".hero-section").classList.contains("is-motion-paused"));
        await page.waitForTimeout(100);
        assert.notEqual(await rocket.getAttribute("style"), paused);

        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.locator(".hero-section.is-motion-paused").waitFor({ state: "attached" });
        const still = await rocket.getAttribute("style");
        await page.waitForTimeout(250);
        assert.equal(await rocket.getAttribute("style"), still);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator(".rocket-orbit").evaluate((element) => { element.style.height = "160px"; });
        await page.waitForFunction((previous) => document.querySelector("[data-rocket]").getAttribute("style") !== previous, still);
        assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
});

test("cached journey geometry follows resizing, schedule switches and FAQ expansion", async () => {
    const page = await pageForTest();
    try {
        await page.goto(base);
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 900 });
            await page.locator("[data-schedule-view-toggle]").click();
            await page.locator(".faq-list summary").first().click();
            await page.evaluate(() => window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * 0.5, behavior: "instant" }));
            await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector(".journey-background").style.getPropertyValue("--journey")) - scrollY / (document.documentElement.scrollHeight - innerHeight)) < 0.001);
            assert.equal(await page.locator(".journey-stars").evaluate((element) => element.classList.contains("is-motion-paused")), true);
            const stage = await page.evaluate(() => [...document.querySelectorAll("[data-stage]")].find((element) => {
                const bounds = element.getBoundingClientRect();
                return bounds.top <= innerHeight * 0.48 && bounds.bottom > innerHeight * 0.48;
            })?.dataset.stage ?? "night");
            assert.equal(await page.locator("body").getAttribute("data-stage"), stage);
            assert.equal(await page.locator("html").evaluate((element) => element.style.getPropertyValue("--journey")), "");
        }
        assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
});

test("text colors stay fixed while the sky changes", async () => {
    const page = await pageForTest();
    try {
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(base);
            await page.locator(".schedule-block__room").first().waitFor({ state: "attached" });
            const textColors = () => page.locator(".about-statement, .open-source-note > p, .prize-place__rank, .schedule-intro, .schedule-simple__time").evaluateAll((elements) => elements.map((element) => getComputedStyle(element).color));
            const originalColors = await textColors();
            for (const progress of [0.18, 0.4, 0.18]) {
                await page.evaluate((progress) => {
                    window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * progress, behavior: "instant" });
                }, progress);
                await page.waitForFunction((progress) => Math.abs(parseFloat(document.querySelector(".journey-background").style.getPropertyValue("--journey")) - progress) < 0.001, progress);
                assert.deepEqual(await textColors(), originalColors);
                assert.equal(await page.locator("[data-sky-tone]").count(), 0);
                assert.equal(await page.locator("[data-schedule-tone]").count(), 0);
            }
        }
        assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
});

test("about links follow the intro and stats; compact event popup works at every size", async () => {
    const page = await pageForTest();
    try {
        await page.goto(base);
        await page.addStyleTag({ content: ".reveal { transition: none !important; transform: none !important; }" });
        await page.locator(".schedule-block__room").first().waitFor({ state: "attached" });
        await page.locator("#about").scrollIntoViewIfNeeded();
        const intro = await page.locator(".about-intro > p").boundingBox();
        const source = await page.locator(".open-source-note").boundingBox();
        const stats = await page.locator(".facts-line").boundingBox();
        const guide = await page.locator(".about-guide .event-guide-button").boundingBox();
        const statement = await page.locator(".about-statement").boundingBox();
        assert.ok(source.y >= intro.y + intro.height && source.y + source.height < stats.y);
        assert.ok(source.x < intro.x && source.width > intro.width * 1.5);
        assert.ok(Math.abs(source.x + source.width - intro.x - intro.width) < 1);
        const sourceLabel = await page.locator(".open-source-note > p").first().boundingBox();
        const sourceCopy = await page.locator(".open-source-note > p").last().boundingBox();
        assert.ok(sourceLabel.x < sourceCopy.x && Math.abs(sourceLabel.y - sourceCopy.y) < 1);
        assert.ok(guide.y >= stats.y + stats.height && guide.y - stats.y - stats.height < 60);
        assert.ok(guide.x < statement.x && Math.abs(guide.y - statement.y) < 1);
        await page.locator(".about-followup").scrollIntoViewIfNeeded();
        await page.locator("#about").screenshot({ path: join(tmpdir(), "hackphs-about-rearranged.png") });

        for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            const view = await page.locator("[data-schedule]").getAttribute("data-active-view");
            const link = page.locator(view === "simple" ? ".schedule-simple a" : ".schedule-table a").filter({ hasText: "AI Panel Discussion" }).first();
            await link.click();
            const dialog = page.locator("[data-event-dialog]");
            await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-event-dialog]")).opacity === "1");
            const bounds = await dialog.boundingBox();
            assert.ok(bounds.width <= 680 && bounds.x >= 0 && bounds.x + bounds.width <= width);
            assert.equal(await dialog.evaluate((element) => element.scrollWidth > element.clientWidth), false);
            assert.match(await page.locator("[data-dialog-room]").textContent(), /Room 153.*New Gym/);
            assert.ok(await page.locator("[data-dialog-title]").evaluate((element) => parseFloat(getComputedStyle(element).fontSize)) <= 40);
            await page.screenshot({ path: join(tmpdir(), `hackphs-event-popup-${width}.png`) });
            await page.keyboard.press("Escape");
            await dialog.waitFor({ state: "hidden" });
            assert.equal(await link.evaluate((element) => element === document.activeElement), true);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        }
        assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
});

test("schedule spans, room details, navigation and mobile layout", async () => {
    const page = await pageForTest();
    try {
        await page.goto(base);
        await page.locator(".schedule-block__room").first().waitFor({ state: "attached" });
        const gridErrors = await page.evaluate(() => {
            const errors = [];
            let spans = Array(5).fill(0);
            for (const [index, row] of [...document.querySelector(".schedule-table tbody").rows].entries()) {
                let column = 0;
                for (const cell of row.cells) {
                    while (spans[column] > 0) column++;
                    for (let offset = 0; offset < cell.colSpan; offset++) {
                        if (column + offset >= 5 || spans[column + offset] > 0) errors.push(`Overlap in row ${index}`);
                        spans[column + offset] = cell.rowSpan;
                    }
                    column += cell.colSpan;
                }
                if (spans.some((span) => span < 1)) errors.push(`Gap in row ${index}`);
                spans = spans.map((span) => Math.max(0, span - 1));
            }
            return errors;
        });
        assert.deepEqual(gridErrors, []);
        assert.equal(await page.locator(".schedule-table .schedule-block--empty .schedule-block__room").count(), 0);
        const publicBlocks = page.locator(".schedule-table td.schedule-block:not(.schedule-block--empty)");
        assert.equal(await publicBlocks.count(), await publicBlocks.locator(".schedule-block__room").count());
        for (const [slug, time, name] of [
            ["nathaniel-daw", "1:00–2:00 PM", "Nathaniel Daw"],
            ["yushu-cheng", "5:30–6:30 PM", "Yushu A. Cheng"],
            ["vritika-singh", "6:30–7:00 PM", "Vritika Singh"],
        ]) {
            const block = page.locator(`.schedule-table [data-event="${slug}"]`);
            assert.equal(await block.locator("small").textContent(), time);
            assert.equal(await block.locator(".schedule-block__room").textContent(), "Room 152");
            await block.locator("a").click();
            await page.locator("[data-event-dialog][open]").waitFor();
            assert.match(await page.locator("[data-dialog-description]").textContent(), new RegExp(name.replaceAll(".", "\\.")));
            await page.keyboard.press("Escape");
            await page.locator("[data-event-dialog][open]").waitFor({ state: "hidden" });
        }
        const panel = page.locator(".schedule-table a").filter({ hasText: "AI Panel Discussion" });
        await panel.click();
        await page.locator("[data-event-dialog][open]").waitFor();
        assert.equal(await page.locator("[data-dialog-title]").textContent(), "AI Panel Discussion");
        assert.match(await page.locator("[data-dialog-room]").textContent(), /Room 153.*New Gym/);
        await page.getByRole("button", { name: /Close/ }).click();
        await page.locator("[data-event-dialog][open]").waitFor({ state: "hidden" });
        await page.goto(`${base}/events.html?event=estimathon`);
        await page.waitForFunction(() => document.querySelector("[data-event-room]")?.textContent === "Room 152");

        for (const width of [1440, 1024, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 960 });
            await page.goto(base);
            await page.locator(".hero-copy.is-visible").waitFor();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
            const badge = await page.locator("#mlh-trust-badge").boundingBox();
            for (const link of await page.locator(".site-nav > a, .years-menu summary").all()) {
                const box = await link.boundingBox();
                const intersects = box.x < badge.x + badge.width && box.x + box.width > badge.x && box.y < badge.y + badge.height && box.y + box.height > badge.y;
                assert.equal(intersects, false, `badge overlaps ${await link.textContent()} at ${width}`);
            }
            if (width === 1440 || width === 390) {
                await page.waitForFunction(() => getComputedStyle(document.querySelector(".hero-copy")).opacity === "1");
                await page.screenshot({ path: join(tmpdir(), `hackphs-home-${width}.png`) });
            }
            if (width === 390) {
                assert.equal(await page.locator("[data-schedule]").getAttribute("data-active-view"), "simple");
                await page.locator("#schedule").scrollIntoViewIfNeeded();
                await page.locator(".schedule-simple a").filter({ hasText: "Chess tournament" }).scrollIntoViewIfNeeded();
                await page.screenshot({ path: join(tmpdir(), "hackphs-schedule-mobile.png") });
                await page.locator("#tracks-title").scrollIntoViewIfNeeded();
                await page.waitForFunction(() => getComputedStyle(document.querySelector(".prize-tracks")).opacity === "1");
                await page.screenshot({ path: join(tmpdir(), "hackphs-tracks-mobile.png") });
            }
        }
        assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
});
