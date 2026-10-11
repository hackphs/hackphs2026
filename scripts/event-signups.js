import { events } from "./events.js?v=20261010y";

// 9 AM in Princeton/New York on October 10 is EDT (UTC-4), not winter EST.
export const signupOpensAt = Date.parse("2026-10-10T09:00:00-04:00");
export const signupsAreOpen = (now = Date.now()) => now >= signupOpensAt;

export function renderEventSignup(element, slug, now = Date.now()) {
    if (!element) return;
    element.dataset.eventSlug = slug || "";
    const event = events[slug];
    element.replaceChildren();
    if (!event?.signupUrl) {
        element.textContent = "Coming soon";
    } else if (!signupsAreOpen(now)) {
        element.textContent = "Opens Saturday at 9:00 AM ET";
    } else {
        const link = document.createElement("a");
        link.href = event.signupUrl;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.className = "event-signup-link";
        link.textContent = "Sign up →";
        link.setAttribute("aria-label", `Sign up for ${event.title} (opens in a new tab)`);
        element.append(link);
    }
}

export function startEventSignups() {
    let timer;
    const refresh = () => {
        window.clearTimeout(timer);
        const now = Date.now();
        document.querySelectorAll("[data-event-signup]").forEach((element) => {
            renderEventSignup(element, element.dataset.eventSlug, now);
        });
        const notice = document.querySelector("[data-signup-notice]");
        if (notice) notice.textContent = signupsAreOpen(now)
            ? "Workshop and event sign-ups are open. Select an event below to sign up."
            : "Workshop and event sign-ups will be posted at 9:00 AM on Saturday, October 10 (ET).";
        const remaining = signupOpensAt - now;
        if (remaining > 0) timer = window.setTimeout(refresh, Math.min(remaining, 60_000));
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
}
