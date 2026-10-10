const levels = [
    { name: "Exemplary", points: 4 },
    { name: "Proficient", points: 3 },
    { name: "Developing", points: 2 },
    { name: "Unacceptable", points: 1 },
];

const pointLabel = (points) => `${points} ${points === 1 ? "pt" : "pts"}`;

const cell = (tag, text) => {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
};

export function renderEventRubric(container, rubric) {
    container.replaceChildren();
    container.hidden = !rubric;

    if (!rubric) {
        return;
    }

    const maxPoints = rubric.length * levels[0].points;
    const table = document.createElement("table");
    const headRow = document.createElement("tr");

    headRow.append(cell("th", "Criterion"));
    for (const level of levels) {
        const heading = cell("th", level.name);
        heading.dataset.level = level.name.toLowerCase();
        heading.append(cell("span", pointLabel(level.points)));
        headRow.append(heading);
    }
    table.createTHead().append(headRow);

    const body = table.createTBody();
    for (const { criterion, levels: descriptions } of rubric) {
        const row = body.insertRow();
        const name = cell("th", criterion);
        name.scope = "row";
        row.append(name);

        descriptions.forEach((text, index) => {
            const description = cell("td", text);
            // Lets the stacked phone layout label each cell without the header row.
            description.dataset.label = `${levels[index].name} · ${pointLabel(levels[index].points)}`;
            description.dataset.level = levels[index].name.toLowerCase();
            row.append(description);
        });
    }

    const wrap = document.createElement("div");
    wrap.className = "event-rubric__scroll";
    wrap.append(table);
    container.append(cell("h2", `Judging rubric · ${maxPoints} points`), wrap);
}
