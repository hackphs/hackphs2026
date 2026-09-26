export const registrationClosesAt = Date.parse("2026-09-30T00:00:00-04:00");

export const registrationUrls = {
    registration: "https://docs.google.com/forms/d/e/1FAIpQLSeebNRWyDxMRbN6KEoL7pdFbbd_xj2PjGi6kFLQ0ATAhoarzQ/viewform?usp=publish-editor",
    waitlist: "https://docs.google.com/forms/d/e/1FAIpQLSfN_dE_l8NowE-lRRQg9nae--dVpGk64qAUv6ZQeHTxs3BEqA/viewform?usp=dialog",
};

export function registrationState(now = Date.now()) {
    const waitlist = now >= registrationClosesAt;
    return {
        url: waitlist ? registrationUrls.waitlist : registrationUrls.registration,
        label: waitlist ? "Join the waitlist" : "Register",
        formLabel: waitlist ? "waitlist form" : "registration form",
        message: waitlist
            ? "Registration has closed. Join the waitlist and we'll reach out if a spot opens."
            : "Registration closes September 29 at 11:59 PM Eastern. After that, sign-ups will go on the waitlist.",
    };
}

export function registrationCountdown(now = Date.now()) {
    const remaining = registrationClosesAt - now;
    if (remaining <= 0) return "Registration closed. Waitlist open.";
    if (remaining < 60_000) return "Registration closes in less than a minute";
    const unit = remaining >= 86_400_000 ? "day" : remaining >= 3_600_000 ? "hour" : "minute";
    const duration = { day: 86_400_000, hour: 3_600_000, minute: 60_000 }[unit];
    const count = Math.ceil(remaining / duration);
    return `Registration closes in ${count} ${unit}${count === 1 ? "" : "s"}`;
}

export function startRegistration() {
    let deadlineTimer;
    const links = document.querySelectorAll("[data-registration-link]");
    const notes = document.querySelectorAll("[data-registration-status]");
    const countdown = document.querySelector("[data-registration-countdown]");
    const bar = document.querySelector("[data-registration-bar]");
    const hero = document.querySelector(".hero-section");

    if (bar && hero) {
        const observer = new IntersectionObserver(([entry]) => {
            const visible = entry.boundingClientRect.bottom <= 0;
            bar.classList.toggle("is-visible", visible);
            bar.inert = !visible;
            bar.setAttribute("aria-hidden", String(!visible));
        });
        observer.observe(hero);
    }

    const update = () => {
        window.clearTimeout(deadlineTimer);
        const now = Date.now();
        const state = registrationState(now);
        for (const link of links) {
            link.href = state.url;
            const isAction = link.classList.contains("primary-action") || link.hasAttribute("data-registration-action");
            const label = isAction ? state.label : state.formLabel;
            if (link.textContent !== label) link.textContent = label;
        }
        for (const note of notes) {
            if (note.textContent !== state.message) note.textContent = state.message;
        }
        const countdownText = registrationCountdown(now);
        if (countdown && countdown.textContent !== countdownText) countdown.textContent = countdownText;

        // Keep the countdown fresh without running a timer in a hidden tab.
        const remaining = registrationClosesAt - now;
        if (remaining > 0 && !document.hidden) {
            deadlineTimer = window.setTimeout(update, Math.min(remaining, 60_000));
        }
    };

    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pageshow", update);
    window.addEventListener("focus", update);
    for (const link of links) {
        link.addEventListener("click", update);
    }
}
