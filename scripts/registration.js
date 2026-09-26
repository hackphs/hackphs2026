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

export function startRegistration() {
    let deadlineTimer;

    const update = () => {
        window.clearTimeout(deadlineTimer);
        const state = registrationState();
        for (const link of document.querySelectorAll("[data-registration-link]")) {
            link.href = state.url;
            link.textContent = link.classList.contains("primary-action") ? state.label : state.formLabel;
        }
        for (const note of document.querySelectorAll("[data-registration-status]")) {
            note.textContent = state.message;
        }

        // Also switch for anyone who leaves the page open over the deadline.
        const remaining = registrationClosesAt - Date.now();
        if (remaining > 0) {
            deadlineTimer = window.setTimeout(update, Math.min(remaining, 2_147_483_647));
        }
    };

    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pageshow", update);
    window.addEventListener("focus", update);
    for (const link of document.querySelectorAll("[data-registration-link]")) {
        link.addEventListener("click", update);
    }
}
