// Noon in Princeton on October 11 is Eastern Daylight Time (UTC-4).
export const EVENT_END = Date.parse("2026-10-11T12:00:00-04:00");

export function startEventCountdown() {
    const countdown = document.querySelector("[data-event-countdown]");
    if (!countdown) return;

    const hours = countdown.querySelector("[data-countdown-hours]");
    const minutes = countdown.querySelector("[data-countdown-minutes]");
    const seconds = countdown.querySelector("[data-countdown-seconds]");
    const title = countdown.querySelector("[data-session-title]");
    const compact = document.querySelector("[data-countdown-compact]");
    let interval;

    const update = () => {
        const remaining = Math.max(0, Math.ceil((EVENT_END - Date.now()) / 1000));
        hours.textContent = String(Math.floor(remaining / 3600)).padStart(2, "0");
        minutes.textContent = String(Math.floor(remaining / 60) % 60).padStart(2, "0");
        seconds.textContent = String(remaining % 60).padStart(2, "0");
        if (compact) compact.textContent = `${hours.textContent}:${minutes.textContent}:${seconds.textContent}`;
        if (remaining === 0) {
            title.textContent = "hackPHS has ended. Thanks for joining us!";
            countdown.querySelector("[data-session-status]").textContent = "Event complete";
            const caption = document.querySelector("[data-countdown-caption]");
            if (caption) caption.textContent = "event ended";
            clearInterval(interval);
        }
    };

    interval = setInterval(update, 1000);
    update();
}
