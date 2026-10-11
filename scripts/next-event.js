export function getNextEvent(events, now = Date.now()) {
    return events.find((event) => event.start > now) ?? null;
}

export function formatTimeUntil(milliseconds) {
    const totalMinutes = Math.max(1, Math.ceil(milliseconds / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;

    if (days) return `${days}d ${hours}h`;
    if (hours) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

export function startNextEvent() {
    const messages = document.querySelectorAll("[data-next-event-message]");
    const panel = document.querySelector("[data-live-schedule]");
    const table = document.querySelector("[data-schedule-table] .schedule-table");
    if ((!messages.length && !panel) || !table) return;

    const simpleStops = [...document.querySelectorAll(".schedule-simple__stop")];
    const rows = [...table.tBodies[0].rows];
    const events = rows.flatMap((row, rowIndex) => {
        const dateTime = row.querySelector("th[scope='row'] time")?.dateTime;
        const start = Date.parse(dateTime ?? "");
        if (!Number.isFinite(start)) return [];
        const simpleStop = simpleStops.find((stop) => stop.querySelector("time")?.dateTime === dateTime);

        return [...row.querySelectorAll("td.schedule-block:not(.schedule-block--empty)")]
            .map((block, blockIndex) => {
                const title = block.querySelector("strong")?.textContent.trim();
                const detailHref = block.querySelector(".schedule-block__link")?.getAttribute("href");
                const simpleEvent = [...(simpleStop?.querySelectorAll(".schedule-simple__event") ?? [])]
                    .find((event) => event.querySelector("strong")?.textContent.trim() === title);
                block.id ||= `schedule-event-${rowIndex}-${blockIndex}`;
                if (simpleEvent) simpleEvent.id ||= `${block.id}-simple`;
                const nextRow = rows.slice(rowIndex + block.rowSpan).find((next) => next.querySelector('th[scope="row"] time'));
                const fallback = Date.parse(nextRow?.querySelector("time").dateTime ?? dateTime);
                return {
                    start, title,
                    end: getScheduleEventEnd(dateTime, block.querySelector("small")?.textContent || "", fallback),
                    room: block.querySelector(".schedule-block__room")?.textContent.trim().replace(/\s+/g, " ") || "",
                    hacking: block.classList.contains("schedule-block--hacking"),
                    href: detailHref || `#${block.id}`,
                    simpleHref: detailHref || `#${simpleEvent?.id || block.id}`,
                };
            })
            .filter((event) => event.title);
    }).sort((a, b) => a.start - b.start);

    const clock = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
    const eventHref = (event) => table.closest("[data-schedule]").dataset.activeView === "simple" ? event.simpleHref : event.href;
    const renderList = (list, items, now, upcoming) => {
        if (!list) return;
        const key = JSON.stringify(items.map((event) => [event.start, event.title]));
        if (list.dataset.items !== key) {
            list.dataset.items = key;
            list.replaceChildren();
            for (const event of items) {
                const item = document.createElement("li");
                const link = document.createElement("a");
                const title = document.createElement("strong");
                const detail = document.createElement("span");
                const timing = document.createElement("span");
                timing.className = "live-schedule__time";
                if (event.room) detail.append(`${event.room} · `);
                detail.append(timing);
                title.textContent = event.title;
                link.append(title, detail);
                link.addEventListener("click", () => { link.href = eventHref(event); });
                item.append(link);
                list.append(item);
            }
            if (!items.length) {
                const empty = document.createElement("li");
                empty.className = "live-schedule__empty";
                empty.textContent = upcoming ? "No events start in the next hour." : "No events are in session right now.";
                list.append(empty);
            }
        }
        items.forEach((event, index) => {
            const link = list.children[index].querySelector("a");
            link.href = eventHref(event);
            const timing = upcoming ? `${clock.format(event.start)} ET · in ${formatTimeUntil(event.start - now)}` : `Until ${clock.format(event.end)} ET`;
            const timeElement = link.querySelector(".live-schedule__time");
            if (timeElement.textContent !== timing) timeElement.textContent = timing;
        });
    };

    const update = () => {
        const now = Date.now();
        const next = getNextEvent(events.filter((event) => !event.hacking), now);
        const text = next
            ? `Next Event in ${formatTimeUntil(next.start - now)}: ${next.title}`
            : "All scheduled events have ended";
        const href = next
            ? (table.closest("[data-schedule]").dataset.activeView === "simple" ? next.simpleHref : next.href)
            : "#schedule";

        for (const message of messages) {
            if (message.textContent !== text) message.textContent = text;
            message.setAttribute("href", href);
        }

        if (panel) {
            const { current, upcoming } = getLiveEvents(events, now);
            renderList(panel.querySelector("[data-current-events]"), current, now, false);
            renderList(panel.querySelector("[data-upcoming-events]"), upcoming, now, true);
        }
    };

    update();
    for (const link of messages) {
        link.addEventListener("click", update);
    }
    setInterval(update, 1000);
}
import { getScheduleEventEnd } from "./schedule-now.js?v=20261010b";

export function getLiveEvents(events, now) {
    events = events.filter((event) => !event.hacking);
    return {
        current: events.filter((event) => event.start <= now && now < event.end),
        upcoming: events.filter((event) => now < event.start && event.start <= now + 3600000),
    };
}
