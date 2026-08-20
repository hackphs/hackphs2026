const categoryNames = {
    hacking: "Main event",
    workshop: "Workshop",
    advanced: "Activity",
    guest: "Guest talk",
    evening: "Late night",
    meal: "Food and rest",
    milestone: "Milestone",
};

export function startSchedule() {
    const schedule = document.querySelector("[data-schedule]");
    const table = schedule?.querySelector(".schedule-table");
    const simpleView = schedule?.querySelector("[data-schedule-simple]");
    const desktopDurationNote = schedule?.querySelector(".schedule-duration-note__desktop");
    const buttons = [...(schedule?.querySelectorAll("[data-schedule-view-button]") ?? [])];

    if (!schedule || !table || !simpleView || !buttons.length) {
        return;
    }

    // the simple view is built from the table so the two versions never drift apart
    const scheduleFragment = document.createDocumentFragment();
    let currentList;

    for (const row of table.tBodies[0].rows) {
        const sourceDate = row.querySelector(".schedule-table__date-inner");

        if (sourceDate) {
            const day = document.createElement("section");
            const dayHeader = sourceDate.cloneNode(true);

            day.className = "schedule-simple__day";
            dayHeader.className = "schedule-simple__date";
            currentList = document.createElement("ol");
            currentList.className = "schedule-simple__list";
            day.append(dayHeader, currentList);
            scheduleFragment.append(day);
            continue;
        }

        const sourceTime = row.querySelector("th[scope='row'] time");
        const blocks = [...row.cells].filter((cell) => (
            cell.matches("td.schedule-block:not(.schedule-block--empty)")
        ));

        if (!currentList || !sourceTime || !blocks.length) {
            continue;
        }

        const stop = document.createElement("li");
        const time = sourceTime.cloneNode(true);
        const events = document.createElement("div");

        stop.className = "schedule-simple__stop";
        stop.classList.toggle("schedule-simple__stop--milestone", blocks.some((block) => (
            block.classList.contains("schedule-block--milestone")
        )));
        time.className = "schedule-simple__time";
        events.className = "schedule-simple__events";

        for (const block of blocks) {
            const tone = Object.keys(categoryNames).find((name) => (
                block.classList.contains(`schedule-block--${name}`)
            )) ?? "advanced";
            const title = block.querySelector("strong")?.textContent.trim();
            const range = block.querySelector("small")?.textContent.trim();

            if (!title) {
                continue;
            }

            const event = document.createElement("article");
            const eventCopy = document.createElement("div");
            const category = document.createElement("span");
            const eventTitle = document.createElement("strong");

            event.className = "schedule-simple__event";
            eventCopy.className = "schedule-simple__event-copy";
            event.dataset.tone = tone;
            category.textContent = block.dataset.label || categoryNames[tone];
            eventTitle.textContent = title;
            eventCopy.append(category, eventTitle);
            event.append(eventCopy);

            if (range && tone !== "milestone") {
                const duration = document.createElement("small");
                const [startText, endText] = range.split("–");
                const startMatch = startText?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
                const endMatch = endText?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);

                if (startMatch && endMatch) {
                    const startPeriod = (startMatch[3] || endMatch[3]).toUpperCase();
                    const endPeriod = endMatch[3].toUpperCase();
                    const startHour = (Number(startMatch[1]) % 12) + (startPeriod === "PM" ? 12 : 0);
                    const endHour = (Number(endMatch[1]) % 12) + (endPeriod === "PM" ? 12 : 0);
                    const startMinutes = (startHour * 60) + Number(startMatch[2]);
                    let endMinutes = (endHour * 60) + Number(endMatch[2]);

                    if (endMinutes <= startMinutes) {
                        endMinutes += 24 * 60;
                    }

                    const totalMinutes = endMinutes - startMinutes;
                    const hours = totalMinutes / 60;

                    duration.textContent = totalMinutes < 60
                        ? `~${totalMinutes} min`
                        : `~${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
                } else {
                    duration.textContent = range;
                }

                event.append(duration);
            }

            events.append(event);
        }

        stop.append(time, events);
        currentList.append(stop);
    }

    simpleView.replaceChildren(scheduleFragment);

    const mobileLayout = window.matchMedia("(max-width: 720px)");
    let viewWasChosen = false;

    const showView = (view) => {
        schedule.dataset.activeView = view;

        if (desktopDurationNote) {
            desktopDurationNote.textContent = view === "simple"
                ? "Durations are approximate"
                : "Longer blocks mean longer events";
        }

        buttons.forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.scheduleViewButton === view));
        });
    };

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            viewWasChosen = true;
            showView(button.dataset.scheduleViewButton);
        });
    });

    mobileLayout.addEventListener("change", () => {
        if (!viewWasChosen) {
            showView(mobileLayout.matches ? "simple" : "table");
        }
    });

    showView(mobileLayout.matches ? "simple" : "table");
}
