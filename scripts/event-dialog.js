import { events } from "./events.js?v=20260820c";

export function startEventDialog() {
    const dialog = document.querySelector("[data-event-dialog]");

    if (!dialog) {
        return;
    }

    const title = dialog.querySelector("[data-dialog-title]");
    const date = dialog.querySelector("[data-dialog-date]");
    const description = dialog.querySelector("[data-dialog-description]");
    const time = dialog.querySelector("[data-dialog-time]");
    const duration = dialog.querySelector("[data-dialog-duration]");
    const room = dialog.querySelector("[data-dialog-room]");
    const closeButton = dialog.querySelector("[data-dialog-close]");

    const showEvent = (eventSlug) => {
        const event = events[eventSlug];

        if (!event) {
            return;
        }

        const [eventDate, ...eventTime] = event.time.split(" · ");

        dialog.classList.toggle("event-dialog--long-title", event.title.length > 34);
        title.textContent = event.title;
        date.textContent = eventDate;
        description.textContent = event.description;
        time.textContent = eventTime.join(" · ");
        duration.textContent = `(${event.duration})`;
        room.textContent = event.room;

        if (!dialog.open) {
            dialog.showModal();
        }
    };

    const returnToSchedule = () => {
        if (window.history.state?.eventSlug) {
            dialog.close();
            window.history.back();
            return;
        }

        dialog.close();
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
        showEvent(eventSlug);
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
            dialog.close();
        }
    });
}
