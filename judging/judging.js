const ENDPOINT = "https://script.google.com/macros/s/AKfycbw0ZaMsb6E1ew3aq128G1sfCnepMDAJbaemiFgy7sxy2rEefc5IELrx_2-X4o4UKz_Eng/exec";
// The backend must return this version; old calibration/finals deployments fail closed.
const VERSION = "tablesets-v1";
const STORAGE_KEY = "hackphs-judging-tablesets-v1";
const MAX_TOTAL = 48;
const BANDS = [[1, 4], [5, 8], [9, 12]];
const POINTS = [15, 10, 5, 0, 0];
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

const els = {
    signinView: document.querySelector('[data-view="signin"]'),
    appView: document.querySelector('[data-view="app"]'),
    signinForm: document.querySelector("[data-signin-form]"),
    signinFeedback: document.querySelector("[data-signin-feedback]"),
    who: document.querySelector("[data-who]"),
    signout: document.querySelector("[data-signout]"),
    sync: document.querySelector("[data-sync]"),
    queueTitle: document.querySelector("[data-queue-title]"),
    queueProgress: document.querySelector("[data-queue-progress]"),
    queue: document.querySelector("[data-queue]"),
    form: document.querySelector("[data-score-form]"),
    criteria: document.querySelector("[data-criteria]"),
    total: document.querySelector("[data-total]"),
    scoreFeedback: document.querySelector("[data-score-feedback]"),
    ranking: document.querySelector("[data-ranking]"),
    rankingForm: document.querySelector("[data-ranking-form]"),
    rankingFields: document.querySelector("[data-ranking-fields]"),
    rankingFeedback: document.querySelector("[data-ranking-feedback]"),
    claim: document.querySelector("[data-claim]"),
    status: document.querySelector("[data-tableset-status]"),
};
let judge = null;
let tablesets = [];
let entries = {};
let busy = false;
let mutation = 0;
let refreshing = false;
let draft = {};
// Persist drafts, not credentials or other judges' data. Each name has its own draft.
function readDraft(name) {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY + ":" + normalize(name))) || {}; }
    catch { return {}; }
}
function saveDraft() {
    if (!judge) return;
    try { localStorage.setItem(STORAGE_KEY + ":" + normalize(judge.name), JSON.stringify(draft)); } catch {}
}
function normalize(value) { return String(value || "").trim().toLowerCase().replace(/\s+/g, " "); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => "&#" + char.charCodeAt(0) + ";"); }
function activeSet() { return tablesets.find((s) => !s.complete); }
function keyOf(set, project) { return JSON.stringify([set, project]); }
function currentEntry(project) { return entries[keyOf(activeSet()?.id, project)]; }
function totalOf(scores) {
    if (CRITERIA.some((c) => !Number.isInteger(Number(scores[c.key])) || Number(scores[c.key]) < 1 || Number(scores[c.key]) > 12)) return null;
    return Math.round(CRITERIA.reduce((sum, c) => sum + c.weight * Number(scores[c.key]) * 4, 0) * 100) / 100;
}
async function api(action, payload = {}, identity = judge) {
    if (!ENDPOINT) throw new Error("Judging is not connected. Ask an organizer for help.");
    const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ version: VERSION, action, judge: identity.name, invitation: identity.invitation, ...payload }),
        signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error("Could not reach judging. Please retry.");
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Request failed.");
    if (action !== "submit" && data.version !== VERSION)
        throw new Error("The organizer needs to deploy the updated judging backend. No scores were changed.");
    return data;
}
function acceptSnapshot(data) {
    tablesets = data.tablesets;
    entries = Object.fromEntries(data.scores.map((entry) => [keyOf(entry.tableset, entry.project), entry]));
}
function feedback(message, error = false) {
    els.scoreFeedback.textContent = message;
    els.scoreFeedback.className = "feedback" + (error ? " is-error" : "");
}
function updateTotal() {
    const data = new FormData(els.form);
    const scores = Object.fromEntries(CRITERIA.map((c) => [c.key, Number(data.get(c.key))]));
    const total = totalOf(scores);
    els.total.textContent = total === null ? "-" : total.toFixed(1);
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

function saveFormDraft() {
    const set = activeSet();
    const project = els.form.elements.project.value;
    if (!judge || !set || !project) return;
    const data = new FormData(els.form);
    draft[keyOf(set.id, project)] = {
        scores: Object.fromEntries(CRITERIA.map((c) => [c.key, Number(data.get(c.key))])),
        notes: String(data.get("notes") || ""),
    };
    saveDraft();
    renderRanking();
}
function loadProject(id) {
    const set = activeSet();
    if (!set?.projects.some((p) => p.id === id)) return;
    els.form.reset();
    els.form.elements.project.value = id;
    const entry = draft[keyOf(set.id, id)] || currentEntry(id);
    if (entry) {
        for (const c of CRITERIA) {
            const input = els.form.querySelector('input[name="' + c.key + '"][value="' + entry.scores[c.key] + '"]');
            if (input) input.checked = true;
        }
        els.form.elements.notes.value = entry.notes || "";
    }
    feedback(draft[keyOf(set.id, id)] ? "Unsaved draft restored. Save this score before finishing the tableset." : "");
    updateTotal();
    renderQueue();
}
function renderQueue() {
    const set = activeSet();
    const selected = els.form.elements.project.value;
    els.queueTitle.textContent = set?.id || "Tablesets";
    els.queueProgress.textContent = set ? set.projects.filter((p) => currentEntry(p.id)).length + " / " + set.projects.length + " saved" : "";
    els.queue.innerHTML = set ? set.projects.map((p) => {
        const saved = currentEntry(p.id);
        const unsaved = !!draft[keyOf(set.id, p.id)];
        return '<li><button type="button" class="queue__item ' + (p.id === selected ? "is-active " : "") +
            (saved ? "is-done" : "") + '" data-project="' + escapeHtml(p.id) + '">' +
            '<span class="queue__name">' + escapeHtml(p.name) + '<span class="queue__meta">Table ' + escapeHtml(p.table) +
            '</span></span><span class="queue__status">' + (unsaved ? "Draft" : saved ? saved.total.toFixed(1) : "To score") + '</span></button></li>';
    }).join("") : '<li class="queue__empty">No active tableset. Request one below, or check with an organizer.</li>';
}
function renderRanking() {
    const set = activeSet();
    els.ranking.hidden = !set;
    if (!set) return;
    const ready = set.projects.every((p) => currentEntry(p.id) && !draft[keyOf(set.id, p.id)]);
    els.rankingForm.querySelector("button").disabled = !ready || busy;
    els.rankingFeedback.textContent = ready ? "Choose a different project for each place. Submission locks this tableset." :
        "Save every rubric score, including any drafts, before submitting your ranking.";
}
function renderApp() {
    const set = activeSet();
    els.form.hidden = !set;
    els.claim.hidden = !!set;
    els.status.textContent = set ? "Score all " + set.projects.length + " projects, then rank them within this tableset. " +
        (set.projects.length < 5 ? "This is the final, smaller tableset." : "") :
        tablesets.length ? "Your tablesets are complete. You can request another unassigned tableset." :
        "No tableset is available right now. Try again or ask an organizer.";
    els.form.elements.project.innerHTML = '<option value="">Choose a project</option>' +
        (set?.projects || []).map((p) => '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + " - Table " + escapeHtml(p.table) + "</option>").join("");
    els.rankingFields.innerHTML = (set?.projects || []).map((_, i) =>
        '<label class="field"><span class="field__label">Place ' + (i + 1) + " - " + POINTS[i] +
        ' points</span><select name="place' + i + '" required><option value="">Choose a project</option>' +
        set.projects.map((p) => '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + "</option>").join("") +
        "</select></label>").join("");
    renderQueue();
    renderRanking();
    if (set) loadProject(set.projects.find((p) => !currentEntry(p.id))?.id || set.projects[0].id);
}
function setBusy(value) {
    if (value) mutation++;
    busy = value;
    els.signout.disabled = value;
    els.claim.disabled = value;
    els.form.querySelectorAll("input, textarea, select, button").forEach((el) => { el.disabled = value; });
    els.rankingForm.querySelectorAll("select, button").forEach((el) => { el.disabled = value; });
    els.queue.querySelectorAll("button").forEach((el) => { el.disabled = value; });
    renderRanking();
}
els.signinForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(els.signinForm);
    const identity = { name: String(form.get("name")).trim(), invitation: String(form.get("invitation")).trim() };
    const button = els.signinForm.querySelector("button");
    button.disabled = true;
    els.signinFeedback.textContent = "Checking your password and assigned name...";
    try {
        const data = await api("config", {}, identity);
        judge = { ...identity, name: data.judge.name };
        acceptSnapshot(data);
        draft = readDraft(judge.name);
        els.signinView.hidden = true;
        els.appView.hidden = false;
        els.who.textContent = judge.name;
        els.who.hidden = els.signout.hidden = false;
        els.signinForm.reset();
        els.sync.textContent = "Connected";
        renderApp();
    } catch (error) { els.signinFeedback.textContent = error.message; }
    finally { button.disabled = false; }
});
els.signout.addEventListener("click", () => {
    if (busy) return;
    judge = null;
    tablesets = [];
    entries = {};
    draft = {};
    els.appView.hidden = true;
    els.signinView.hidden = false;
    els.who.hidden = els.signout.hidden = true;
    els.who.textContent = els.sync.textContent = els.signinFeedback.textContent = "";
    els.form.reset();
    els.queue.replaceChildren();
    els.rankingFields.replaceChildren();
});
els.form.addEventListener("input", (event) => {
    if (event.target.name === "project") return;
    updateTotal();
    saveFormDraft();
});
els.form.elements.project.addEventListener("change", (event) => { if (!busy) loadProject(event.target.value); });
els.queue.addEventListener("click", (event) => {
    const button = event.target.closest("[data-project]");
    if (button && !busy) loadProject(button.dataset.project);
});
els.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    const set = activeSet();
    const data = new FormData(els.form);
    const project = String(data.get("project") || "");
    const scores = Object.fromEntries(CRITERIA.map((c) => [c.key, Number(data.get(c.key))]));
    if (!set?.projects.some((p) => p.id === project) || totalOf(scores) === null) {
        feedback("Choose an assigned project and score all five criteria from 1 to 12.", true);
        return;
    }
    saveFormDraft();
    setBusy(true);
    feedback("Saving...");
    try {
        const result = await api("submit", { entry: { tableset: set.id, project, scores, notes: String(data.get("notes") || "") } });
        entries[keyOf(set.id, project)] = result.entry;
        delete draft[keyOf(set.id, project)];
        saveDraft();
        feedback("Score saved. You can edit it until you submit the tableset ranking.");
        els.sync.textContent = "Saved to judging sheet";
    } catch (error) {
        feedback(error.message + " Your draft remains on this device; retry saving.", true);
        els.sync.textContent = "Not saved";
    } finally { setBusy(false); renderQueue(); renderRanking(); }
});
els.rankingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    const set = activeSet();
    const data = new FormData(els.rankingForm);
    const ranking = set.projects.map((_, i) => String(data.get("place" + i) || ""));
    if (new Set(ranking).size !== ranking.length || ranking.some((id) => !set.projects.some((p) => p.id === id))) {
        els.rankingFeedback.textContent = "Choose every project exactly once; no duplicate places.";
        return;
    }
    if (!window.confirm("Submit and lock this tableset ranking? Scores and order cannot be edited afterward.")) return;
    setBusy(true);
    try {
        acceptSnapshot(await api("complete", { tableset: set.id, ranking }));
        renderApp();
        els.sync.textContent = "Tableset completed";
    } catch (error) { els.rankingFeedback.textContent = error.message + " You can retry the same ranking safely."; }
    finally { setBusy(false); }
});
els.claim.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    els.status.textContent = "Checking for an unassigned tableset...";
    try { acceptSnapshot(await api("claim")); renderApp(); }
    catch (error) { els.status.textContent = error.message; }
    finally { setBusy(false); }
});
window.addEventListener("beforeunload", (event) => {
    if (busy || Object.keys(draft).length) { event.preventDefault(); event.returnValue = ""; }
});
async function refresh() {
    if (!judge || busy || refreshing || document.hidden) return;
    refreshing = true;
    const identity = judge;
    const revision = mutation;
    try {
        const data = await api("config");
        if (judge !== identity || busy || mutation !== revision) return;
        const nextEntries = Object.fromEntries(data.scores.map((entry) => [keyOf(entry.tableset, entry.project), entry]));
        if (JSON.stringify(tablesets) === JSON.stringify(data.tablesets) && JSON.stringify(entries) === JSON.stringify(nextEntries)) {
            els.sync.textContent = "Connected";
            return;
        }
        const selected = els.form.elements.project.value;
        const activeId = activeSet()?.id;
        const ranking = [...els.rankingForm.querySelectorAll("select")].map((el) => el.value);
        acceptSnapshot(data);
        const liveIds = new Set(tablesets.filter((s) => !s.complete).flatMap((s) => s.projects.map((p) => keyOf(s.id, p.id))));
        for (const key of Object.keys(draft)) if (!liveIds.has(key)) delete draft[key];
        saveDraft();
        renderApp();
        if (activeId === activeSet()?.id) {
            if (selected) loadProject(selected);
            els.rankingForm.querySelectorAll("select").forEach((el, i) => { el.value = ranking[i] || ""; });
        }
        els.sync.textContent = "Connected";
    } catch (error) {
        if (judge === identity) els.sync.textContent = "Refresh failed: " + error.message;
    } finally { refreshing = false; }
}
window.setInterval(refresh, 30000);
window.addEventListener("focus", refresh);
window.addEventListener("online", refresh);
renderCriteria();
