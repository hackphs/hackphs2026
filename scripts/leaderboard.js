import { fetchStandings } from "./leaderboard-data.js?v=20260925";

export function startLeaderboard() {
    const rows = document.querySelector("[data-standings]");
    const table = document.querySelector("[data-standings-table]");
    const podium = document.querySelector("[data-podium]");
    const podiumPlaces = document.querySelector("[data-podium-places]");
    const status = document.querySelector("[data-score-status]");
    const message = document.querySelector("[data-score-message]");
    const updated = document.querySelector("[data-score-updated]");
    const count = document.querySelector("[data-team-count]");
    const refresh = document.querySelector("[data-refresh-scores]");
    const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 10 });
    const clock = new Intl.DateTimeFormat("en-US", {
        hour: "numeric", minute: "2-digit", second: "2-digit",
        timeZone: "America/New_York", timeZoneName: "short",
    });
    let loading = false;
    let lastSuccess = null;
    let previousSnapshot = "";

    function renderPodium(teams) {
        const fragment = document.createDocumentFragment();
        const placeNames = ["1st", "2nd", "3rd"];

        for (const rank of [1, 2, 3]) {
            // Tied teams share a step instead of being assigned a false lower place.
            const leaders = teams.filter((team) => team.rank === rank);
            const place = document.createElement("li");
            const teamNames = document.createElement("div");
            const step = document.createElement("div");
            place.className = "podium-place";
            place.dataset.place = rank;
            place.classList.toggle("is-empty", leaders.length === 0);
            teamNames.className = "podium-teams";
            step.className = "podium-step";
            step.setAttribute("aria-label", `${placeNames[rank - 1]} place`);

            const ribbon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            ribbon.setAttribute("class", "podium-ribbon");
            ribbon.setAttribute("viewBox", "0 0 280 180");
            ribbon.setAttribute("preserveAspectRatio", "none");
            ribbon.setAttribute("aria-hidden", "true");
            const ribbonPath = "M45 0 C45 65 82 75 140 112 C198 75 235 65 235 0";
            for (const stripe of ["podium-ribbon-band", "podium-ribbon-stripe"]) {
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", ribbonPath);
                path.setAttribute("class", stripe);
                path.setAttribute("vector-effect", "non-scaling-stroke");
                ribbon.append(path);
            }
            const medal = document.createElement("span");
            medal.className = "podium-medal";
            medal.textContent = rank;
            medal.setAttribute("aria-hidden", "true");
            step.append(ribbon, medal);

            if (leaders.length > 1) {
                const tie = document.createElement("span");
                tie.className = "podium-tie";
                tie.textContent = `Tied for ${placeNames[rank - 1]}`;
                teamNames.append(tie);
            }
            for (const team of leaders) {
                const name = document.createElement("strong");
                name.className = "podium-team-name";
                name.textContent = team.name;
                teamNames.append(name);
            }
            const score = document.createElement("p");
            score.className = "podium-score";
            if (leaders.length) {
                score.textContent = number.format(leaders[0].score);
                const unit = document.createElement("span");
                unit.textContent = " points";
                score.append(unit);
            } else {
                score.textContent = "";
            }
            teamNames.append(score);
            place.append(teamNames, step);
            fragment.append(place);
        }
        podiumPlaces.replaceChildren(fragment);
        podium.hidden = teams.length === 0;
    }

    async function refreshScores() {
        if (loading) return;
        loading = true;
        refresh.disabled = true;
        refresh.textContent = "Refreshing...";
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 12000);

        try {
            const { teams, pending } = await fetchStandings({ signal: controller.signal });
            const remainingTeams = teams.filter((team) => team.rank > 3);
            const snapshot = JSON.stringify(teams);
            if (snapshot !== previousSnapshot) {
                const fragment = document.createDocumentFragment();
                for (const team of remainingTeams) {
                    const row = document.createElement("tr");
                    for (const [index, value] of [team.rank, team.name, number.format(team.score)].entries()) {
                        const cell = document.createElement(index === 1 ? "th" : "td");
                        if (index === 1) cell.scope = "row";
                        cell.textContent = value;
                        row.append(cell);
                    }
                    row.dataset.rank = team.rank;
                    fragment.append(row);
                }
                rows.replaceChildren(fragment);
                renderPodium(teams);
                previousSnapshot = snapshot;
            }
            table.hidden = remainingTeams.length === 0;
            count.textContent = `${teams.length} ${teams.length === 1 ? "team" : "teams"} ranked`;
            message.hidden = teams.length > 0 && pending === 0;
            message.textContent = teams.length === 0
                ? "No scores yet. The standings will appear here when the first scores are posted."
                : `${pending} ${pending === 1 ? "team is" : "teams are"} waiting for a score.`;
            lastSuccess = new Date();
            updated.dateTime = lastSuccess.toISOString();
            updated.textContent = `Last checked ${clock.format(lastSuccess)}`;
            status.textContent = teams.length ? "Scores up to date" : "Waiting for scores";
            status.dataset.state = "connected";
        } catch {
            // Keep the last good standings on screen if the Wi-Fi drops.
            status.dataset.state = "offline";
            status.textContent = lastSuccess ? "Updates interrupted" : "Scores unavailable";
            message.hidden = false;
            message.textContent = lastSuccess
                ? "These are the last successfully loaded standings, not live scores. We'll retry automatically."
                : "We couldn't load the standings. Check your connection and try Refresh. We'll also retry automatically.";
        } finally {
            window.clearTimeout(timeout);
            loading = false;
            refresh.disabled = false;
            refresh.textContent = "Refresh";
        }
    }

    refresh.addEventListener("click", refreshScores);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) refreshScores();
    });
    window.addEventListener("online", refreshScores);
    window.setInterval(() => {
        if (!document.hidden) refreshScores();
    }, 30000);
    refreshScores();
}

startLeaderboard();
