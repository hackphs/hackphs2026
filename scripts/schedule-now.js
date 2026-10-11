export function getSchedulePosition(times, now) {
    const index = times.findIndex((start, i) => start <= now && now < times[i + 1]);
    if (index < 0) return null;
    return { index, progress: (now - times[index]) / (times[index + 1] - times[index]) };
}

export function getScheduleEventEnd(startDate, range, fallback) {
    const end = range.match(/[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (!end) return fallback;
    const endMinutes = (Number(end[1]) % 12 + (end[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(end[2] || 0);
    const startMinutes = Number(startDate.slice(11, 13)) * 60 + Number(startDate.slice(14, 16));
    const minutes = (endMinutes - startMinutes + 1440) % 1440 || 1440;
    return Date.parse(startDate) + minutes * 60000;
}

export function startScheduleNow() {
    const schedule = document.querySelector("[data-schedule]");
    if (!schedule) return;

    const clock = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York", hour: "numeric", minute: "2-digit",
    });
    const rows = [...schedule.querySelectorAll(".schedule-table tbody tr")];
    const simpleStops = [...schedule.querySelectorAll(".schedule-simple__stop")];
    const events = rows.flatMap((row, index) => {
        const date = row.querySelector('th[scope="row"] time')?.dateTime;
        if (!date) return [];
        const simpleStop = simpleStops.find((stop) => stop.querySelector("time")?.dateTime === date);
        return [...row.querySelectorAll("td.schedule-block:not(.schedule-block--empty)")].map((block) => {
            const nextRow = rows.slice(index + block.rowSpan).find((next) => next.querySelector('th[scope="row"] time'));
            const fallback = Date.parse(nextRow?.querySelector("time").dateTime ?? date);
            const title = block.querySelector("strong")?.textContent.trim();
            const simpleEvent = [...(simpleStop?.querySelectorAll(".schedule-simple__event") ?? [])]
                .find((event) => event.querySelector("strong")?.textContent.trim() === title);
            return {
                start: Date.parse(date),
                end: getScheduleEventEnd(date, block.querySelector("small")?.textContent || "", fallback),
                elements: [block, simpleEvent].filter(Boolean),
            };
        });
    });
    const views = [
        [...schedule.querySelectorAll('.schedule-table th[scope="row"] time')],
        [...schedule.querySelectorAll(".schedule-simple__time")],
    ].map((elements) => {
        const marker = document.createElement("span");
        marker.className = "schedule-now";
        marker.setAttribute("role", "timer");
        marker.setAttribute("aria-live", "off");
        const label = document.createElement("span");
        label.className = "schedule-now__label";
        const nowLabel = document.createElement("b");
        nowLabel.textContent = "Now";
        const time = document.createElement("span");
        label.append(nowLabel, time);
        marker.append(label);
        return { elements, times: elements.map((element) => Date.parse(element.dateTime)), marker, time };
    });

    const update = () => {
        const now = Date.now();
        for (const event of events) {
            const active = event.start <= now && now < event.end;
            for (const element of event.elements) {
                element.classList.toggle("is-happening-now", active);
                if (active) element.setAttribute("aria-current", "time");
                else element.removeAttribute("aria-current");
            }
        }
        for (const view of views) {
            const position = getSchedulePosition(view.times, now);
            if (!position) {
                view.marker.remove();
                continue;
            }
            const element = view.elements[position.index];
            const host = element.matches(".schedule-simple__time") ? element : element.parentElement;
            if (view.marker.parentElement !== host) host.append(view.marker);
            view.marker.style.top = `${position.progress * 100}%`;
            view.time.textContent = `${clock.format(now)} ET`;
            view.marker.setAttribute("aria-label", `Current time: ${clock.format(now)} Eastern`);
        }
    };

    update();
    setInterval(update, 15000);
    document.addEventListener("visibilitychange", update);
}
