import { teamRoster } from "./team-data.js?v=20261013";

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function renderTeam(container, roster = teamRoster) {
    if (!container) return;
    const directors = element("section", "team-directors");
    const directorHeading = element("h2", "team-section-heading", "Directors");
    directorHeading.id = "directors-title";
    directors.setAttribute("aria-labelledby", directorHeading.id);
    directors.append(directorHeading);
    const directorRow = element("div", "team-directors__row");
    roster.directors.forEach((director, index) => {
        const card = element("article", "team-director");
        card.append(element("p", "team-eyebrow", "Director"));
        card.append(element("h3", "", director.name || `Director ${index + 1}`));
        if (!director.name) card.append(element("p", "team-pending", "Name pending"));
        directorRow.append(card);
    });
    directors.append(directorRow);
    const groups = element("section", "team-groups");
    const sectionHeading = element("h2", "team-section-heading", "Section Directors & Organizers");
    sectionHeading.id = "sections-title";
    groups.setAttribute("aria-labelledby", sectionHeading.id);
    groups.append(sectionHeading);
    const sectionGrid = element("div", "team-groups__grid");
    roster.sections.forEach((section, index) => {
        const group = element("section", "team-group");
        const heading = element("h3", "", section.name || `Section ${index + 1}`);
        heading.id = `${section.id}-title`;
        group.setAttribute("aria-labelledby", heading.id);
        group.append(heading);
        if (!section.name) group.append(element("p", "team-pending", "Section name pending"));
        group.append(element("h4", "team-role", "Section Directors"));
        if (section.heads.length) {
            const heads = element("ul", "team-heads");
            section.heads.forEach(name => heads.append(element("li", "", name)));
            group.append(heads);
        } else group.append(element("p", "team-pending", "Name pending"));
        group.append(element("h4", "team-role", "Organizers"));
        if (section.organizers.length) {
            const organizers = element("ul", "team-organizers");
            section.organizers.forEach(name => organizers.append(element("li", "", name)));
            group.append(organizers);
        } else group.append(element("p", "team-pending", "Roster pending"));
        sectionGrid.append(group);
    });
    groups.append(sectionGrid);
    container.replaceChildren(directors, groups);
    const pending = roster.directors.some(director => !director.name) || roster.sections.some(section => !section.name || !section.heads.length || !section.organizers.length);
    const preview = document.querySelector("[data-team-preview]");
    if (preview) preview.hidden = !pending;
}

renderTeam(document.querySelector("[data-team-roster]"));
