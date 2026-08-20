import { events } from "./events.js?v=20260820c";

const eventSlug = new URLSearchParams(window.location.search).get("event");
const event = events[eventSlug];
const sheet = document.querySelector("[data-event-sheet]");

if (!event) {
    document.title = "Event not found | hackPHS 2026";
    sheet.classList.add("event-sheet--missing");
    sheet.querySelector("[data-event-title]").textContent = "We couldn't find that event";
    sheet.querySelector("[data-event-description]").textContent = "Head back to the schedule and choose an event to see its details.";
    sheet.querySelector(".event-details").remove();
} else {
    const [eventDate, ...eventTime] = event.time.split(" · ");

    document.title = `${event.title} | hackPHS 2026`;
    document.querySelector("meta[name='description']").content = `${event.title} at hackPHS 2026.`;
    sheet.classList.toggle("event-sheet--long-title", event.title.length > 34);
    sheet.querySelector("[data-event-title]").textContent = event.title;
    sheet.querySelector("[data-event-date]").textContent = eventDate;
    sheet.querySelector("[data-event-description]").textContent = event.description;
    sheet.querySelector("[data-event-time]").textContent = eventTime.join(" · ");
    sheet.querySelector("[data-event-duration]").textContent = `(${event.duration})`;
    sheet.querySelector("[data-event-room]").textContent = event.room;
}
