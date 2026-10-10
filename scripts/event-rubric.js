const levelNames = ["Exemplary", "Proficient", "Developing", "Unacceptable"];

// Each criterion collapses so the long rubric doesn't bury the time and room.
export function renderEventRubric(container, rubric) {
    container.replaceChildren();
    container.hidden = !rubric;

    if (!rubric) {
        return;
    }

    const heading = document.createElement("h2");
    heading.textContent = "Judging rubric";
    container.append(heading);

    for (const { criterion, focus, levels } of rubric) {
        const item = document.createElement("details");
        const summary = document.createElement("summary");
        const name = document.createElement("span");
        const tag = document.createElement("small");
        const list = document.createElement("dl");

        name.textContent = criterion;
        tag.textContent = focus;
        summary.append(name, tag);

        levels.forEach((text, index) => {
            const row = document.createElement("div");
            const level = document.createElement("dt");
            const description = document.createElement("dd");

            row.dataset.level = levelNames[index].toLowerCase();
            level.textContent = levelNames[index];
            description.textContent = text;
            row.append(level, description);
            list.append(row);
        });

        item.append(summary, list);
        container.append(item);
    }
}
