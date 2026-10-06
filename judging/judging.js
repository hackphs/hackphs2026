// Paste the Google Apps Script web app URL here (see judging/apps-script.gs for setup).
// While this is empty the page runs in local mode: scores stay on the device and can be exported as CSV.
const ENDPOINT = "https://script.google.com/macros/s/AKfycbwYEqQm_br4TB04-94HqcGKu10TsmfFu_vHcsFaLd5qaJ8itGh121XVPzepJH2xVTnS/exec";

const STORAGE_KEY = "hackphs-judging-2026";
const MAX_TOTAL = 48;
const BANDS = [[1, 4], [5, 8], [9, 12]];

const CRITERIA = [
    {
        key: "innovation",
        label: "Innovativeness",
        weight: 0.25,
        bands: [
            "A basic way of implementing this, which has been documented many times before.",
            "A fairly common but also advanced way of running this type of project.",
            "A unique and effective way of carrying out the purpose of the project. The innovation must be a plus: if it makes the project work worse than the basic way, it doesn't count.",
        ],
    },
    {
        key: "functionality",
        label: "Functionality",
        weight: 0.3,
        bands: [
            "Very limited or low functionality.",
            "Project is consistent but runs into errors and bugs from time to time.",
            "Project works perfectly 100% of the time.",
        ],
    },
    {
        key: "creativity",
        label: "Creativity",
        weight: 0.25,
        bands: [
            "A very common idea without much development in concept.",
            "A very nice concept, but something that could reasonably be thought of.",
            "A very creative and unique project that hasn't been replicated much. The developers clearly put significant effort into the idea.",
        ],
    },
    {
        key: "theme",
        label: "Theme",
        hint: "Into the skies",
        weight: 0.1,
        bands: [
            "Has nothing to do with “into the skies”.",
            "Requires some thinking to see the theme of skies shine through.",
            "Obviously “into the skies”.",
        ],
    },
    {
        key: "technical",
        label: "Technical",
        hint: "Account for how much of the work was done by AI",
        weight: 0.1,
        bands: ["Low skill.", "Medium skill.", "High skill."],
    },
];

const ROUNDS = {
    calibration: {
        label: "Calibration",
        queueTitle: "Sample project",
        intro:
            "Start here. Every judge scores the same sample project from hackPHS 2025, so we can even out judges who naturally score higher or lower.",
    },
    round1: {
        label: "Round 1",
        queueTitle: "Your projects",
        intro:
            "Score each project you've been assigned. Every project gets at least two judges, and the top 10 move on to the executive panel.",
    },
    finals: {
        label: "Finals",
        queueTitle: "Finalists",
        execOnly: true,
        intro: "Executive panel: score every finalist. Scores are averaged, and the top 3 win overall.",
    },
    tracks: {
        label: "Track prizes",
        queueTitle: "Track projects",
        intro: "Score the projects that entered a track prize. Pick the track first, then the project.",
    },
};

const DEFAULT_SAMPLE_PROJECT = "Sample project (hackPHS 2025)";

const els = {
    signinView: document.querySelector('[data-view="signin"]'),
    appView: document.querySelector('[data-view="app"]'),
    signinForm: document.querySelector("[data-signin-form]"),
    signinFeedback: document.querySelector("[data-signin-feedback]"),
    who: document.querySelector("[data-who]"),
    signout: document.querySelector("[data-signout]"),
    sync: document.querySelector("[data-sync]"),
    localNotice: document.querySelector("[data-local-notice]"),
    tabs: document.querySelector("[data-tabs]"),
    roundIntro: document.querySelector("[data-round-intro]"),
    queueTitle: document.querySelector("[data-queue-title]"),
    queueProgress: document.querySelector("[data-queue-progress]"),
    queue: document.querySelector("[data-queue]"),
    exportButton: document.querySelector("[data-export]"),
    form: document.querySelector("[data-score-form]"),
    criteria: document.querySelector("[data-criteria]"),
    trackField: document.querySelector("[data-track-field]"),
    projectOptions: document.querySelector("#project-options"),
    trackOptions: document.querySelector("#track-options"),
    total: document.querySelector("[data-total]"),
    scoreFeedback: document.querySelector("[data-score-feedback]"),
};

const state = loadState();
let flushing = false;
let syncError = "";

function loadState() {
    const defaults = { judge: null, config: null, round: "calibration", entries: {}, outbox: [] };
    try {
        return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
    } catch {
        return defaults;
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Storage can be unavailable (private mode); the session still works until the tab closes.
    }
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function normalize(value) {
    return String(value || "").trim().toLowerCase();
}

function entryId(judge, round, track, project) {
    return [judge, round, track, project].map(normalize).join("|");
}

function totalOf(scores) {
    let total = 0;
    for (const criterion of CRITERIA) {
        const score = Number(scores[criterion.key]);
        if (!score) {
            return null;
        }
        total += criterion.weight * score;
    }
    return Math.round(total * (MAX_TOTAL / 12) * 100) / 100;
}

function formatTotal(total) {
    return total === null ? "–" : total.toFixed(1);
}

function isLocalMode() {
    return !ENDPOINT;
}

function isExec() {
    return isLocalMode() || state.judge?.role === "exec";
}

function config() {
    return state.config || {};
}

function sampleProject() {
    return config().sampleProject || DEFAULT_SAMPLE_PROJECT;
}

function myEntries() {
    return Object.values(state.entries).filter((entry) => normalize(entry.judge) === normalize(state.judge?.name));
}

function findEntry(round, track, project) {
    return state.entries[entryId(state.judge.name, round, track, project)];
}

async function api(action, payload = {}, judge = state.judge) {
    const response = await fetch(ENDPOINT, {
        method: "POST",
        // text/plain keeps this a "simple" request, so Apps Script doesn't need a CORS preflight.
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, judge: judge.name, code: judge.code, ...payload }),
    });
    const data = await response.json();
    if (!data.ok) {
        throw new Error(data.error || "Request failed");
    }
    return data;
}

/* Sync */

function updateSync() {
    els.sync.className = "sync";
    if (!state.judge) {
        els.sync.textContent = "";
        return;
    }
    if (isLocalMode()) {
        els.sync.textContent = "Local only";
        els.sync.classList.add("is-pending");
    } else if (flushing) {
        els.sync.textContent = "Saving…";
        els.sync.classList.add("is-pending");
    } else if (state.outbox.length) {
        els.sync.textContent = `${state.outbox.length} unsent`;
        els.sync.classList.add(syncError ? "is-error" : "is-pending");
    } else {
        els.sync.textContent = "All saved";
        els.sync.classList.add("is-ok");
    }
    els.sync.title = syncError;
}

async function flushOutbox() {
    if (isLocalMode() || flushing || !state.judge || !state.outbox.length) {
        updateSync();
        return;
    }
    flushing = true;
    updateSync();
    try {
        while (state.outbox.length) {
            const id = state.outbox[0];
            const entry = state.entries[id];
            if (entry) {
                await api("submit", { entry });
            }
            // Only drop it if it wasn't edited again while the request was in flight.
            if (state.entries[id] === entry) {
                state.outbox.shift();
                saveState();
            }
        }
        syncError = "";
    } catch (error) {
        syncError = error.message;
    } finally {
        flushing = false;
        updateSync();
        renderQueue();
    }
}

async function refreshConfig() {
    if (isLocalMode()) {
        return;
    }
    try {
        const data = await api("config");
        state.config = data.config;
        state.judge.role = data.judge.role;
        for (const entry of data.scores) {
            if (!state.outbox.includes(entry.id)) {
                state.entries[entry.id] = entry;
            }
        }
        saveState();
        renderApp();
    } catch (error) {
        syncError = error.message;
        updateSync();
    }
}

/* Sign in / out */

async function handleSignin(event) {
    event.preventDefault();
    const data = new FormData(els.signinForm);
    const judge = { name: String(data.get("name")).trim(), code: String(data.get("code")).trim(), role: "judge" };
    if (!judge.name) {
        return;
    }

    if (isLocalMode()) {
        state.judge = { ...judge, role: "exec" };
        saveState();
        showApp();
        return;
    }

    const button = els.signinForm.querySelector("button");
    button.disabled = true;
    els.signinFeedback.className = "feedback";
    els.signinFeedback.textContent = "Signing in…";
    try {
        const response = await api("config", {}, judge);
        state.judge = { name: response.judge.name, code: judge.code, role: response.judge.role };
        state.config = response.config;
        for (const entry of response.scores) {
            state.entries[entry.id] = entry;
        }
        saveState();
        els.signinFeedback.textContent = "";
        showApp();
        flushOutbox();
    } catch (error) {
        els.signinFeedback.classList.add("is-error");
        els.signinFeedback.textContent =
            error instanceof TypeError ? "Couldn't reach the score sheet. Check your connection." : error.message;
    } finally {
        button.disabled = false;
    }
}

function handleSignout() {
    const unsent = state.outbox.length;
    const message = unsent
        ? `${unsent} score(s) haven't been sent yet and will be lost. Sign out anyway?`
        : "Sign out of judging on this device?";
    if (!window.confirm(message)) {
        return;
    }
    state.judge = null;
    state.config = null;
    state.entries = {};
    state.outbox = [];
    saveState();
    showSignin();
}

function showSignin() {
    els.appView.hidden = true;
    els.signinView.hidden = false;
    els.who.hidden = true;
    els.signout.hidden = true;
    els.signinForm.reset();
    updateSync();
}

function showApp() {
    els.signinView.hidden = true;
    els.appView.hidden = false;
    els.who.hidden = false;
    els.signout.hidden = false;
    els.localNotice.hidden = !isLocalMode();
    renderApp();
    selectRound(state.round, { keepForm: false });
}

/* Rendering */

function renderApp() {
    els.who.textContent = state.judge.name + (state.judge.role === "exec" && !isLocalMode() ? " · Exec panel" : "");
    renderTabs();
    renderQueue();
    updateSync();
}

function availableRounds() {
    return Object.keys(ROUNDS).filter((round) => !ROUNDS[round].execOnly || isExec());
}

function renderTabs() {
    const rounds = availableRounds();
    if (!rounds.includes(state.round)) {
        state.round = rounds[0];
    }
    els.tabs.innerHTML = rounds
        .map(
            (round) =>
                `<button class="tab" type="button" role="tab" data-round="${round}" aria-selected="${round === state.round}">${ROUNDS[round].label}</button>`
        )
        .join("");
}

function renderCriteria() {
    els.criteria.innerHTML = CRITERIA.map(
        (criterion) => `
        <fieldset class="criterion" data-criterion="${criterion.key}">
            <legend class="criterion__head">
                <span class="criterion__name">${criterion.label}</span>
                <span class="criterion__weight">${Math.round(criterion.weight * 100)}%</span>
            </legend>
            ${criterion.hint ? `<p class="criterion__hint">${criterion.hint}</p>` : ""}
            <div class="bands">
                ${BANDS.map(
                    ([low, high], index) => `
                    <div class="band">
                        <p class="band__text">${criterion.bands[index]}</p>
                        <div class="band__scores">
                            ${Array.from({ length: high - low + 1 }, (_, offset) => low + offset)
                                .map(
                                    (score) => `
                                <label class="score-chip">
                                    <input type="radio" name="${criterion.key}" value="${score}" aria-label="${criterion.label} ${score}" />
                                    <span>${score}</span>
                                </label>`
                                )
                                .join("")}
                        </div>
                    </div>`
                ).join("")}
            </div>
        </fieldset>`
    ).join("");
}

function currentTrack() {
    return state.round === "tracks" ? els.form.elements.track.value.trim() : "";
}

function queueProjects() {
    const { projects = [], assignments = [], finalists = [] } = config();
    const byName = new Map(projects.map((project) => [normalize(project.name), project]));
    const lookup = (name) => byName.get(normalize(name)) || { name };

    switch (state.round) {
        case "calibration":
            return [{ name: sampleProject() }];
        case "round1":
            return assignments.length ? assignments.map(lookup) : projects;
        case "finals":
            return finalists.map(lookup);
        case "tracks": {
            const track = normalize(currentTrack());
            if (!track) {
                return [];
            }
            return projects.filter((project) => (project.tracks || []).some((name) => normalize(name) === track));
        }
        default:
            return [];
    }
}

function renderQueue() {
    if (!state.judge) {
        return;
    }
    const round = state.round;
    const track = currentTrack();
    const projects = queueProjects();
    const activeProject = normalize(els.form.elements.project.value);

    // Anything this judge scored that isn't in the list (typed by hand) still shows up so it can be edited.
    const listed = new Set(projects.map((project) => normalize(project.name)));
    const extras = myEntries()
        .filter((entry) => entry.round === round && normalize(entry.track) === normalize(track))
        .filter((entry) => !listed.has(normalize(entry.project)))
        .map((entry) => ({ name: entry.project }));
    const items = [...projects, ...extras];

    els.queueTitle.textContent = ROUNDS[round].queueTitle;
    const done = items.filter((project) => findEntry(round, track, project.name)).length;
    els.queueProgress.textContent = items.length ? `${done} / ${items.length} scored` : "";

    if (!items.length) {
        const message =
            round === "tracks" && !track
                ? "Pick a track in the form to see its projects."
                : "No list from the organizers yet. Type the project name in the form.";
        els.queue.innerHTML = `<li class="queue__empty">${message}</li>`;
    } else {
        els.queue.innerHTML = items
            .map((project) => {
                const entry = findEntry(round, track, project.name);
                const pending = entry && state.outbox.includes(entry.id);
                const classes = [
                    "queue__item",
                    entry ? "is-done" : "",
                    pending ? "is-pending" : "",
                    normalize(project.name) === activeProject ? "is-active" : "",
                ].join(" ");
                const meta = project.table ? `<span class="queue__meta">Table ${escapeHtml(project.table)}</span>` : "";
                return `<li><button class="${classes}" type="button" data-project="${escapeHtml(project.name)}">
                    <span class="queue__name">${escapeHtml(project.name)}${meta}</span>
                    <span class="queue__status">${entry ? formatTotal(entry.total) : "To score"}</span>
                </button></li>`;
            })
            .join("");
    }

    const options = round === "tracks" ? projects : items;
    els.projectOptions.innerHTML = options.map((project) => `<option value="${escapeHtml(project.name)}"></option>`).join("");
    const tracks = [...new Set((config().projects || []).flatMap((project) => project.tracks || []))];
    els.trackOptions.innerHTML = tracks.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
}

function updateTotal() {
    const data = new FormData(els.form);
    const scores = Object.fromEntries(CRITERIA.map((criterion) => [criterion.key, data.get(criterion.key)]));
    els.total.textContent = formatTotal(totalOf(scores));
    for (const fieldset of els.criteria.querySelectorAll(".criterion.is-missing")) {
        if (data.get(fieldset.dataset.criterion)) {
            fieldset.classList.remove("is-missing");
        }
    }
}

function setFeedback(message, kind = "") {
    els.scoreFeedback.className = `feedback ${kind ? `is-${kind}` : ""}`;
    els.scoreFeedback.textContent = message;
}

function clearScores() {
    for (const input of els.criteria.querySelectorAll("input")) {
        input.checked = false;
    }
    els.form.elements.notes.value = "";
    for (const fieldset of els.criteria.querySelectorAll(".criterion")) {
        fieldset.classList.remove("is-missing");
    }
    updateTotal();
}

function resetForm() {
    const track = els.form.elements.track.value;
    clearScores();
    const projectInput = els.form.elements.project;
    projectInput.readOnly = state.round === "calibration";
    projectInput.value = state.round === "calibration" ? sampleProject() : "";
    els.form.elements.track.value = state.round === "tracks" ? track : "";
    if (state.round === "calibration") {
        loadProject(sampleProject());
    }
}

function loadProject(name) {
    const projectInput = els.form.elements.project;
    projectInput.value = name;
    clearScores();
    const entry = findEntry(state.round, currentTrack(), name);
    if (entry) {
        for (const criterion of CRITERIA) {
            const input = els.form.querySelector(`input[name="${criterion.key}"][value="${entry.scores[criterion.key]}"]`);
            if (input) {
                input.checked = true;
            }
        }
        els.form.elements.notes.value = entry.notes || "";
        setFeedback(`Editing your score for ${entry.project}. Submitting again replaces it.`);
    } else {
        setFeedback("");
    }
    updateTotal();
    renderQueue();
}

function selectRound(round, { keepForm = false } = {}) {
    state.round = availableRounds().includes(round) ? round : availableRounds()[0];
    saveState();
    for (const tab of els.tabs.querySelectorAll(".tab")) {
        tab.setAttribute("aria-selected", String(tab.dataset.round === state.round));
    }
    els.roundIntro.textContent = ROUNDS[state.round].intro;
    els.trackField.hidden = state.round !== "tracks";
    els.form.elements.track.required = state.round === "tracks";
    if (!keepForm) {
        resetForm();
        setFeedback("");
    }
    renderQueue();
}

/* Submitting */

function handleSubmit(event) {
    event.preventDefault();
    const data = new FormData(els.form);
    const round = state.round;
    const project = String(data.get("project")).trim();
    const track = round === "tracks" ? String(data.get("track")).trim() : "";

    if (round === "tracks" && !track) {
        setFeedback("Pick a track first.", "error");
        els.form.elements.track.focus();
        return;
    }
    if (!project) {
        setFeedback("Enter the project name.", "error");
        els.form.elements.project.focus();
        return;
    }

    const scores = {};
    const missing = [];
    for (const criterion of CRITERIA) {
        const value = Number(data.get(criterion.key));
        if (!value) {
            missing.push(criterion);
        }
        scores[criterion.key] = value;
    }
    if (missing.length) {
        for (const criterion of missing) {
            els.criteria.querySelector(`[data-criterion="${criterion.key}"]`).classList.add("is-missing");
        }
        els.criteria.querySelector(`[data-criterion="${missing[0].key}"]`).scrollIntoView({ behavior: "smooth", block: "center" });
        setFeedback(`Still needs a score: ${missing.map((criterion) => criterion.label).join(", ")}.`, "error");
        return;
    }

    const id = entryId(state.judge.name, round, track, project);
    const entry = {
        id,
        judge: state.judge.name,
        round,
        track,
        project,
        scores,
        total: totalOf(scores),
        notes: String(data.get("notes")).trim(),
        updatedAt: new Date().toISOString(),
    };
    state.entries[id] = entry;
    if (!state.outbox.includes(id) && !isLocalMode()) {
        state.outbox.push(id);
    }
    saveState();

    setFeedback(`Saved ${project}: ${formatTotal(entry.total)} / ${MAX_TOTAL}.`, "ok");
    clearScores();
    if (round !== "calibration") {
        els.form.elements.project.value = "";
    } else {
        loadProject(project);
        setFeedback(`Saved ${project}: ${formatTotal(entry.total)} / ${MAX_TOTAL}. Move on to Round 1 when you're ready.`, "ok");
    }
    renderQueue();
    flushOutbox();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function exportCsv() {
    const header = ["judge", "round", "track", "project", ...CRITERIA.map((criterion) => criterion.key), "total", "notes", "updatedAt"];
    const rows = myEntries().map((entry) => [
        entry.judge,
        entry.round,
        entry.track,
        entry.project,
        ...CRITERIA.map((criterion) => entry.scores[criterion.key]),
        entry.total,
        entry.notes,
        entry.updatedAt,
    ]);
    const csv = [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `hackphs-judging-${normalize(state.judge.name).replace(/[^a-z0-9]+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

/* Wiring */

renderCriteria();

els.signinForm.addEventListener("submit", handleSignin);
els.signout.addEventListener("click", handleSignout);
els.exportButton.addEventListener("click", exportCsv);
els.form.addEventListener("submit", handleSubmit);
els.form.addEventListener("change", updateTotal);
els.form.addEventListener("reset", (event) => {
    event.preventDefault();
    resetForm();
    setFeedback("");
    renderQueue();
});

els.tabs.addEventListener("click", (event) => {
    const tab = event.target.closest(".tab");
    if (tab) {
        selectRound(tab.dataset.round);
    }
});

els.queue.addEventListener("click", (event) => {
    const item = event.target.closest("[data-project]");
    if (item) {
        loadProject(item.dataset.project);
        els.form.scrollIntoView({ behavior: "smooth", block: "start" });
    }
});

els.form.elements.track.addEventListener("input", () => {
    els.form.elements.project.value = "";
    clearScores();
    renderQueue();
});

els.form.elements.project.addEventListener("change", (event) => {
    const name = event.target.value.trim();
    if (name && findEntry(state.round, currentTrack(), name)) {
        loadProject(name);
    } else {
        renderQueue();
    }
});

window.addEventListener("online", flushOutbox);
window.setInterval(flushOutbox, 30000);

if (state.judge) {
    showApp();
    refreshConfig();
    flushOutbox();
} else {
    showSignin();
}
