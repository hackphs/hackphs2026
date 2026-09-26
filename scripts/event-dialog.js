import { events } from "./events.js?v=20260925";

const categoryLabels = {
    hacking: "Main Event",
    workshop: "Workshops",
    advanced: "Activities",
    guest: "Guest Talks",
    evening: "Late Night",
    meal: "Food and Rest",
    milestone: "Milestones",
};

export function startEventDialog() {
    const dialog = document.querySelector("[data-event-dialog]");

    if (!dialog) {
        return;
    }

    const title = dialog.querySelector("[data-dialog-title]");
    const breadcrumb = dialog.querySelector("[data-dialog-breadcrumb]");
    const date = dialog.querySelector("[data-dialog-date]");
    const description = dialog.querySelector("[data-dialog-description]");
    const time = dialog.querySelector("[data-dialog-time]");
    const duration = dialog.querySelector("[data-dialog-duration]");
    const room = dialog.querySelector("[data-dialog-room]");
    const closeButton = dialog.querySelector("[data-dialog-close]");
    let closeTimer;

    const showEvent = (eventSlug, sourceLink) => {
        const event = events[eventSlug];

        if (!event) {
            return;
        }

        const [eventDate, ...eventTime] = event.time.split(" · ");
        const scheduleLink = sourceLink || [...document.querySelectorAll(".schedule-block__link")].find((link) =>
            new URL(link.href).searchParams.get("event") === eventSlug
        );
        const block = scheduleLink?.closest(".schedule-block, .schedule-simple__event");
        const category = block?.dataset.tone || Object.keys(categoryLabels).find((name) => block?.classList.contains(`schedule-block--${name}`));
        breadcrumb.textContent = `hackPHS / Schedule / ${categoryLabels[category] || "Event"}`;
        const tint = block ? getComputedStyle(block).getPropertyValue("--block-tint").trim() : "";
        dialog.style.setProperty("--event-accent", tint ? `rgb(${tint})` : "#d5ab4c");

        dialog.classList.toggle("event-dialog--long-title", event.title.length > 34);
        title.textContent = event.title;
        date.textContent = eventDate;
        description.textContent = event.description;
        time.textContent = eventTime.join(" · ");
        duration.textContent = `(${event.duration})`;
        room.textContent = event.room;

        window.clearTimeout(closeTimer);
        dialog.classList.remove("is-closing");

        if (!dialog.open) {
            dialog.showModal();
        }

        window.requestAnimationFrame(() => dialog.classList.add("is-open"));
    };

    const hideEvent = (afterClose) => {
        if (!dialog.open || dialog.classList.contains("is-closing")) {
            return;
        }

        dialog.classList.remove("is-open");
        dialog.classList.add("is-closing");
        closeTimer = window.setTimeout(() => {
            dialog.close();
            dialog.classList.remove("is-closing");
            afterClose?.();
        }, 220);
    };

    const returnToSchedule = () => {
        const shouldGoBack = Boolean(window.history.state?.eventSlug);

        hideEvent(() => {
            if (shouldGoBack) {
                window.history.back();
            }
        });
    };

    document.addEventListener("click", (clickEvent) => {
        const link = clickEvent.target.closest("a[href*='/events.html?event=']");

        if (!link || clickEvent.button !== 0 || clickEvent.metaKey || clickEvent.ctrlKey || clickEvent.shiftKey || clickEvent.altKey) {
            return;
        }

        const eventSlug = new URL(link.href).searchParams.get("event");

        if (!events[eventSlug]) {
            return;
        }

        clickEvent.preventDefault();
        window.history.pushState({ ...window.history.state, eventSlug }, "", window.location.href);
        showEvent(eventSlug, link);
    });

    closeButton.addEventListener("click", returnToSchedule);
    dialog.addEventListener("cancel", (cancelEvent) => {
        cancelEvent.preventDefault();
        returnToSchedule();
    });
    dialog.addEventListener("click", (clickEvent) => {
        if (clickEvent.target === dialog) {
            returnToSchedule();
        }
    });
    window.addEventListener("popstate", () => {
        const eventSlug = window.history.state?.eventSlug;

        if (eventSlug && events[eventSlug]) {
            showEvent(eventSlug);
        } else if (dialog.open) {
            hideEvent();
        }
    });
}
