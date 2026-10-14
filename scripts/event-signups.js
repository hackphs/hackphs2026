import { events } from "./events.js?v=20261011prizes";

// 9 AM in Princeton/New York on October 10 is EDT (UTC-4), not winter EST.
export const signupOpensAt = Date.parse("2026-10-10T09:00:00-04:00");
// Sign-ups ended with the event; retain the historical opening window.
export const signupClosesAt = Date.parse("2026-10-11T12:00:00-04:00");
export const signupsAreOpen = (now = Date.now()) => now >= signupOpensAt && now < signupClosesAt;

export function renderEventSignup(element, slug, now = Date.now()) {
    if (!element) return;
    element.dataset.eventSlug = slug || "";
    const event = events[slug];
    const heading = element.previousElementSibling;
    if (heading?.tagName === "DT") heading.textContent = event?.signupHeading || "Sign-up";
    element.replaceChildren();
    if (now >= signupClosesAt) {
        element.textContent = event?.signupUrl
            ? (event.signupHeading === "Voting" ? "Voting is closed." : "Sign-ups are closed.")
            : "This event has ended.";
    } else if (event?.signupMessage) {
        element.textContent = event.signupMessage;
    } else if (!event?.signupUrl) {
        element.textContent = "Coming soon";
    } else if (!signupsAreOpen(now)) {
        element.textContent = "Opens Saturday at 9:00 AM ET";
    } else {
        const link = document.createElement("a");
        link.href = event.signupUrl;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.className = "event-signup-link";
        link.textContent = `${event.signupLabel || "Sign up"} →`;
        link.setAttribute("aria-label", `${event.signupLabel || "Sign up"} for ${event.title} (opens in a new tab)`);
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
        if (notice) notice.textContent = now >= signupClosesAt
            ? "Workshop and event sign-ups are closed."
            : signupsAreOpen(now)
                ? "Workshop and event sign-ups are open. Select an event below to sign up."
                : "Workshop and event sign-ups will be posted at 9:00 AM on Saturday, October 10 (ET).";
        const remaining = (now < signupOpensAt ? signupOpensAt : signupClosesAt) - now;
        if (remaining > 0) timer = window.setTimeout(refresh, Math.min(remaining, 60_000));
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
}
