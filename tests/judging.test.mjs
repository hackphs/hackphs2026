import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createHash } from "node:crypto";

const source = readFileSync(new URL("../judging/apps-script.gs", import.meta.url), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

class Sheet {
    constructor(data = []) { this.data = structuredClone(data); this.maxColumns = 34; this.rules = []; }
    getLastRow() { return this.data.length; }
    getLastColumn() { return Math.max(1, ...this.data.map((r) => r.length)); }
    getMaxColumns() { return this.maxColumns; }
    getMaxRows() { return 1000; }
    hideColumns() {}
    getConditionalFormatRules() { return this.rules; }
    setConditionalFormatRules(rules) { this.rules = rules; }
    insertColumnAfter() { this.maxColumns++; }
    insertColumnBefore(col) { this.data.forEach((r) => r.splice(col - 1, 0, "")); this.maxColumns++; }
    deleteColumn(col) { this.data.forEach((r) => r.splice(col - 1, 1)); this.maxColumns--; }
    deleteColumns(col, count) { this.data.forEach((r) => r.splice(col - 1, count)); this.maxColumns -= count; }
    getDataRange() { return this.getRange(1, 1, Math.max(1, this.data.length), this.getLastColumn()); }
    getRange(row, col, height = 1, width = 1) {
        return {
            getNumColumns: () => width,
            getNumRows: () => height,
            getValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => this.data[row - 1 + i]?.[col - 1 + j] ?? "")),
            setValues: (values) => {
                assert.equal(values.length, height);
                values.forEach((line, i) => {
                    assert.equal(line.length, width);
                    const dest = this.data[row - 1 + i] ||= [];
                    line.forEach((value, j) => { dest[col - 1 + j] = value; });
                });
            },
            setValue: (value) => { (this.data[row - 1] ||= [])[col - 1] = value; },
            setBackground() { return this; },
            setFontColor() { return this; },
            setFontWeight() { return this; },
            setWrap() { return this; },
            setNote() { return this; },
            setNumberFormat() { return this; },
        };
    }
    appendRow(row) { this.data.push([...row]); }
    clearContents() { this.data = []; }
    setFrozenRows() {}
    setFrozenColumns() {}
    setColumnWidth() {}
    setColumnWidths() {}
    copyTo(book) {
        const copied = book.insertSheet("Copy");
        copied.data = structuredClone(this.data);
        copied.data.forEach((row) => row.forEach((value, i) => {
            if (value instanceof Date) row[i] = new Date(value.getTime() + 3 * 60 * 60 * 1000);
        }));
        copied.setName = (name) => { delete book.tabs.Copy; book.tabs[name] = copied; return copied; };
        return copied;
    }
}
class Book {
    constructor(data = {}) { this.tabs = Object.fromEntries(Object.entries(data).map(([name, values]) => [name, new Sheet(values)])); }
    getSheetByName(name) { return this.tabs[name] || null; }
    insertSheet(name) { return this.tabs[name] = new Sheet(); }
    toast() {}
    getId() { return this.id || "private"; }
    getUrl() { return "private-workbook"; }
}
function backend(count = 15) {
    const sourceBook = new Book({
        Judges: [["Name", "Phone Number"], ["Judge A", "private-phone"], ["Judge B"], ["Judge C"]],
        Expo: [["Table #", "Project Name", "Project Link", "Track"], ...Array.from({ length: count }, (_, i) => [i + 1, "Project " + (i + 1), "", ""])],
    });
    const privateBook = new Book();
    sourceBook.id = "source";
    const properties = {};
    let held = false, blocked = false, lockCount = 0, uuid = 0, sharing = "PRIVATE";
    const context = vm.createContext({
        SpreadsheetApp: {
            newConditionalFormatRule: () => ({
                whenFormulaSatisfied(formula) { this.formula = formula; return this; },
                setBackground(color) { this.background = color; return this; },
                setFontColor(color) { this.foreground = color; return this; },
                setBold() { return this; },
                setRanges(ranges) { this.ranges = ranges; return this; },
                build() { return this; },
                getBooleanCondition() { return { getCriteriaValues: () => [this.formula] }; },
                getRanges() { return this.ranges; },
            }),
            flush() {},
            openById: (id) => id === "private" ? privateBook : sourceBook,
            create: () => privateBook,
            getActiveSpreadsheet: () => sourceBook,
            getUi: () => ({ alert() {} }),
        },
        PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties[key], setProperty: (key, value) => { properties[key] = value; }, deleteProperty: (key) => { delete properties[key]; } }) },
        DriveApp: { Access: { PRIVATE: "PRIVATE" }, getFileById: () => ({ getSharingAccess: () => sharing }) },
        Utilities: { getUuid: () => "project-id-" + (++uuid), DigestAlgorithm: { SHA_256: "sha256" },
            computeDigest: (algorithm, input) => [...createHash(algorithm).update(input).digest()],
            base64Encode: (bytes) => Buffer.from(bytes).toString("base64") },
        LockService: { getScriptLock: () => ({ tryLock() { if (blocked) return false; assert.equal(held, false, "no nested lock"); held = true; lockCount++; return true; }, waitLock() { assert.equal(held, false, "no nested lock"); held = true; lockCount++; }, releaseLock() { held = false; } }) },
        ContentService: { MimeType: { JSON: "json" }, createTextOutput: (value) => ({ setMimeType: () => JSON.parse(value) }) },
    });
    vm.runInContext(source, context);
    context.setup();
    context.buildTablesets();
    properties.JUDGING_DEFER_REPORTS = "true";
    const rawRequest = (action, judge = "Judge A", extra = {}) => context.doPost({ postData: { contents: JSON.stringify({ version: "tablesets-v2", invitation: "Invitation", retryBusy: true, judge, action, ...extra }) } });
    const request = (...args) => { const result = rawRequest(...args); context.flushJudgingReports(); return result; };
    return { context, request, rawRequest, sourceBook, privateBook, properties, setBlocked: (value) => { blocked = value; }, setSharing: (value) => { sharing = value; }, lockCount: () => lockCount };
}
const rubric = (value = 8) => Object.fromEntries(["innovation", "functionality", "creativity", "theme", "technical"].map((key) => [key, value]));
function finish(h, judge = "Judge A") {
    const set = h.request("config", judge).tablesets.find((s) => !s.complete);
    for (const project of set.projects) {
        const response = h.request("submit", judge, { entry: { tableset: set.id, project: project.id, scores: rubric(), notes: "" } });
        assert.equal(response.ok, true, response.error);
    }
    const ranking = set.projects.map((p) => p.id);
    assert.equal(h.request("complete", judge, { tableset: set.id, ranking }).ok, true);
    return { set, ranking };
}

test("fast completion acknowledges durable ranking without a snapshot and safely retries", () => {
    const h = backend(5);
    const set = h.request("config").tablesets[0];
    const ranking = set.projects.map((p) => p.id);
    const payload = { tableset: set.id, ranking, completionAck: true };
    assert.equal(h.rawRequest("complete", "Judge A", payload).ok, false);
    for (const p of set.projects) assert.equal(h.rawRequest("submit", "Judge A", {
        entry: { tableset: set.id, project: p.id, scores: rubric() }
    }).ok, true);
    h.context.snapshot = () => { throw new Error("Snapshot unavailable"); };
    assert.deepEqual(plain(h.rawRequest("complete", "Judge A", payload)), { version: "tablesets-v2", completedTableset: set.id, ok: true });
    assert.deepEqual(plain(h.rawRequest("complete", "Judge A", payload)), { version: "tablesets-v2", completedTableset: set.id, ok: true });
    assert.deepEqual(JSON.parse(h.privateBook.tabs.Tablesets.data[1][3]), ranking);
    assert.equal(h.rawRequest("submit", "Judge A", { entry: { tableset: set.id, project: ranking[0], scores: rubric() } }).ok, false);
});

test("score writes return before reports, busy requests do not write, and failed reports retry", () => {
    const h = backend(5);
    const set = h.request("config").tablesets[0];
    const entry = { tableset: set.id, project: set.projects[0].id, scores: rubric(), notes: "Saved first" };
    const boardBefore = plain(h.privateBook.tabs["Review Board"].data);
    h.setBlocked(true);
    const rejected = h.rawRequest("submit", "Judge A", { entry });
    assert.equal(rejected.retryable, true);
    assert.equal(h.privateBook.tabs.Scores.data.length, 1);
    h.setBlocked(false);
    assert.equal(h.rawRequest("submit", "Judge A", { entry }).ok, true);
    assert.equal(h.privateBook.tabs.Scores.data.length, 2);
    assert.deepEqual(plain(h.privateBook.tabs["Review Board"].data), boardBefore);
    assert.equal(h.privateBook.tabs["Judge Notes"].data.length, 1);
    assert.equal(h.properties.JUDGING_REPORTS_DIRTY, "true");
    h.setBlocked(true);
    h.context.flushJudgingReports();
    assert.equal(h.properties.JUDGING_REPORTS_DIRTY, "true");
    h.setBlocked(false);
    h.setSharing("PUBLIC");
    assert.throws(() => h.context.flushJudgingReports(), /Restricted/);
    assert.equal(h.properties.JUDGING_REPORTS_DIRTY, "true");
    h.setSharing("PRIVATE");
    h.context.flushJudgingReports();
    assert.equal(h.properties.JUDGING_REPORTS_DIRTY, undefined);
    assert.equal(h.privateBook.tabs["Judge Notes"].data[1][3], "Saved first");
    assert.equal(h.rawRequest("submit", "Judge A", { entry }).ok, true);
    assert.equal(h.privateBook.tabs.Scores.data.length, 2, "same project save updates rather than duplicates");
});

test("project display cache expires safely, invalidates on Expo edits, and never authorizes allocation", () => {
    const h = backend(5);
    h.context.preassignFirstRound();
    const cache = new Map();
    h.context.CacheService = { getScriptCache: () => ({
        get: (key) => cache.get(key),
        put: (key, value, ttl) => { assert.equal(ttl, 15); cache.set(key, value); },
        remove: (key) => cache.delete(key),
    }) };
    assert.equal(h.rawRequest("config").ok, true);
    assert.equal(cache.size, 1);
    h.sourceBook.tabs.Expo.data[1][1] = "Live rename";
    h.context.refreshChangedExpo();
    assert.equal(cache.size, 0);
    assert.equal(h.rawRequest("config").ok, true);
    assert.ok(h.context.pollingProjects().some((p) => p.name === "Live rename"));
    h.setSharing("PUBLIC");
    assert.equal(h.rawRequest("config").ok, false, "cached projects do not bypass private sharing checks");
    h.setSharing("PRIVATE");
    finish(h, "Judge A");
    finish(h, "Judge B");
    h.sourceBook.tabs.Expo.data.push([6, "New during judging", "", ""]);
    finish(h, "Judge C");
    const after = h.rawRequest("config", "Judge C");
    assert.doesNotMatch(after.assignmentMessage, /Every project has three/);
    const next = h.rawRequest("claim", "Judge C");
    assert.equal(next.ok, true, next.error);
    assert.ok(next.tablesets.some((s) => s.projects.some((p) => p.name === "New during judging")));
    h.context.CacheService = { getScriptCache() { throw new Error("Cache unavailable"); } };
    assert.equal(h.rawRequest("config").ok, true);
});

test("preassign first round reserves five projects per judge and is safe to rerun", () => {
    const h = backend(15);
    h.context.preassignFirstRound();
    const all = h.context.sets(h.privateBook).filter((s) => s.judge);
    assert.equal(all.length, 3);
    assert.ok(all.every((s) => s.projects.length === 5));
    const before = plain(h.privateBook.tabs.Tablesets.data);
    h.context.preassignFirstRound();
    assert.deepEqual(plain(h.privateBook.tabs.Tablesets.data), before);
    const reports = h.privateBook.tabs.Results.data;
    assert.equal(h.request("config").tablesets.length, 1);
    assert.equal(h.privateBook.tabs.Results.data, reports, "preassigned sign-in does not rebuild reports");
    finish(h);
    h.context.preassignFirstRound();
    assert.equal(h.request("config").tablesets.length, 1, "no second set until the judge asks");
    assert.equal(h.request("claim").tablesets.length, 2);
});

test("preassignment respects limited projects and the three-review cap", () => {
    const h = backend(5);
    h.sourceBook.tabs.Judges.data.push(["Judge D"]);
    h.context.preassignFirstRound();
    const all = h.context.sets(h.privateBook).filter((s) => s.judge);
    assert.equal(all.length, 3);
    for (const p of h.context.readProjects()) {
        const assigned = all.filter((s) => s.projects.some((item) => item.id === p.id));
        assert.equal(assigned.length, 3);
        assert.equal(new Set(assigned.map((s) => s.judge)).size, 3);
    }
    assert.equal(h.privateBook.tabs.Scores.data.length, 1);
});

test("spreadsheet preassign checkbox reports success and resets without UI prompts", () => {
    const h = backend(5);
    const controls = h.sourceBook.tabs.Judges;
    controls.getName = () => "Judges";
    while (controls.data.length < 8) controls.data.push([]);
    controls.getRange(7, 4).setValue("Preassign first round - check to run");
    h.context.refreshJudgeNamesOnEdit({
        source: { getId: () => "1e7VEti7X3wOMY8BUuunV2pPakoqeuaP2rDj5lu060l0" },
        range: { getSheet: () => controls, getColumn: () => 5, getRow: () => 7,
            setValue: (value) => controls.getRange(7, 5).setValue(value) }, value: "TRUE",
    });
    assert.equal(controls.data[6][4], false);
    assert.match(controls.data[7][4], /3 first sets assigned/);
    assert.equal(h.context.sets(h.privateBook).filter((s) => s.judge).length, 3);
});

test("roster and Invitation are both required; legacy requests fail closed", () => {
    const h = backend();
    assert.equal(h.request("config", " Judge   A ").judge.name, "Judge A");
    assert.equal(h.request("config", "Unlisted Judge").ok, false);
    assert.equal(h.request("config", "Judge B", { invitation: "wrong" }).ok, false);
    assert.equal(h.request("config", "Judge B", { version: "old" }).ok, false);
    h.sourceBook.tabs.Judges.data[1][0] = "Removed";
    assert.equal(h.request("config", "Judge A").ok, false);
});

test("consolidation requires restricted source, preserves live scores, and switches without duplicate assignments", () => {
    const h = backend(10);
    finish(h);
    const active = h.request("claim").tablesets.find((s) => !s.complete);
    const oldScores = structuredClone(h.privateBook.tabs.Scores.data);
    const oldSets = structuredClone(h.privateBook.tabs.Tablesets.data);
    h.setSharing("ANYONE_WITH_LINK");
    assert.throws(() => h.context.consolidateOrganizerWorkbook(), /Restricted/);
    assert.equal(h.properties.JUDGING_PRIVATE_SHEET_ID, "private");
    h.setSharing("PRIVATE");
    h.context.consolidateOrganizerWorkbook();
    assert.equal(h.properties.JUDGING_PRIVATE_SHEET_ID, "source");
    assert.equal(h.properties.JUDGING_BACKUP_SHEET_ID, "private");
    assert.deepEqual(plain(h.sourceBook.tabs.Scores.data), plain(oldScores));
    assert.deepEqual(plain(h.sourceBook.tabs.Tablesets.data), plain(oldSets));
    assert.equal(h.request("config").tablesets.find((s) => !s.complete).id, active.id);
    assert.equal(h.request("submit", "Judge A", { entry: { tableset: active.id, project: active.projects[0].id, scores: rubric(), notes: "Live after migration" } }).ok, true);
    assert.equal(h.sourceBook.tabs.Scores.data.length, oldScores.length + 1);
    assert.deepEqual(plain(h.privateBook.tabs.Scores.data), plain(oldScores), "backup stays unchanged");
    h.context.consolidateOrganizerWorkbook();
    assert.equal(h.sourceBook.tabs.Scores.data.length, oldScores.length + 1, "rerunning does not reset scores");
    h.setSharing("ANYONE_WITH_LINK");
    assert.equal(h.request("config").ok, false, "fail closed if consolidated workbook becomes public");
});

test("claims are locked, exclusive, idempotent, and limited to one unfinished set", () => {
    const h = backend();
    const a = h.request("config");
    const b = h.request("config", "Judge B");
    assert.equal(a.tablesets[0].projects.length, 5);
    assert.notEqual(a.tablesets[0].id, b.tablesets[0].id);
    assert.equal(h.request("claim").tablesets.length, 1);
    assert.equal(h.request("config").tablesets[0].id, a.tablesets[0].id);
    assert.ok(h.lockCount() >= 3);
    finish(h);
    assert.equal(h.request("claim").tablesets.length, 2);
    assert.equal(h.request("claim").tablesets.length, 2);
});

test("preassigned sign-in and polling require no global write lock", () => {
    const h = backend();
    h.context.preassignFirstRound(false);
    const before = h.lockCount();
    const stored = plain(h.privateBook.tabs.Tablesets.data);
    for (const name of ["Judge A", "Judge B", "Judge C"]) {
        const login = h.request("login", name);
        assert.equal(login.ok, true);
        assert.equal(login.judge.name, name);
        assert.equal(login.tablesets, undefined, "login authenticates before assignment loading");
        for (let poll = 0; poll < 10; poll++) assert.equal(h.request("config", name).ok, true);
    }
    assert.equal(h.lockCount(), before, "read-only requests must not queue behind writes");
    assert.deepEqual(plain(h.privateBook.tabs.Tablesets.data), stored);
    assert.equal(h.request("login", "Unknown").ok, false);
    assert.equal(h.request("login", "Judge A", { invitation: "wrong" }).ok, false);
});

test("judge cannot score or rank someone else's tableset; validate full rubric and membership", () => {
    const h = backend();
    const set = h.request("config").tablesets[0];
    const entry = { tableset: set.id, project: set.projects[0].id, scores: rubric() };
    assert.equal(h.request("submit", "Judge B", { entry }).ok, false);
    assert.equal(h.request("submit", "Judge A", { entry: { ...entry, project: "fake" } }).ok, false);
    for (const bad of [0, 13, 2.5, "8", null]) {
        assert.equal(h.request("submit", "Judge A", { entry: { ...entry, scores: { ...rubric(), technical: bad } } }).ok, false);
    }
    const saved = h.request("submit", "Judge A", { entry });
    assert.equal(saved.entry.total, 32);
    assert.equal(h.request("submit", "Judge A", { entry }).ok, true);
    assert.equal(h.privateBook.tabs.Scores.data.length, 2, "same score upserts");
    const ranking = set.projects.map((p) => p.id);
    assert.equal(h.request("complete", "Judge B", { tableset: set.id, ranking }).ok, false);
    assert.equal(h.request("complete", "Judge A", { tableset: set.id, ranking }).ok, false, "all scores required");
    assert.equal(h.request("complete", "Judge A", { tableset: set.id, ranking: Array(5).fill(ranking[0]) }).ok, false);
});

test("ranking awards 15/10/5/0/0, commits once, and locks editing", () => {
    const h = backend(5);
    const { set, ranking } = finish(h);
    assert.equal(h.request("complete", "Judge A", { tableset: set.id, ranking }).ok, true);
    assert.equal(h.request("complete", "Judge A", { tableset: set.id, ranking: [...ranking].reverse() }).ok, false);
    assert.equal(h.request("submit", "Judge A", { entry: { tableset: set.id, project: ranking[0], scores: rubric(12) } }).ok, false);
    h.context.computeResults();
    assert.deepEqual(h.privateBook.tabs.Results.data.slice(1).map((r) => r[4]), [15, 10, 5, 0, 0]);
    assert.equal(h.request("claim").tablesets.length, 1, "no completed set reassigned");
});

test("organizer board distinguishes pending, blank and zero; notes use project names and stay private", () => {
    const h = backend(5);
    h.request("config", "Judge B");
    const set = h.request("config").tablesets[0];
    const entry = { tableset: set.id, project: set.projects[0].id, scores: rubric(), notes: "Working prototype; ask about testing." };
    assert.equal(h.request("submit", "Judge A", { entry }).ok, true);
    const note = h.privateBook.tabs["Judge Notes"].data[1];
    assert.equal(note[1], set.projects[0].name);
    assert.equal(note[2], "Judge A");
    assert.equal(note[3], entry.notes);
    assert.equal(note[5], "Saved - review in progress");
    for (const project of set.projects.slice(1)) {
        assert.equal(h.request("submit", "Judge A", { entry: { ...entry, project: project.id, notes: "" } }).ok, true);
    }
    const boardBefore = h.privateBook.tabs["Review Board"].data;
    assert.deepEqual(boardBefore[0], ["Table", "Project", "Judges pending", "Judge A", "Judge B", "Judge C", "Total points /45"]);
    assert.ok(boardBefore.slice(1).every((r) => r[2] === "Judge B; Judge A; 1 not yet assigned" && r[3] === "" && r[6] === ""));
    assert.equal(h.request("complete", "Judge A", { tableset: set.id, ranking: set.projects.map((p) => p.id) }).ok, true);
    const board = h.privateBook.tabs["Review Board"].data;
    for (const [i, project] of set.projects.entries()) {
        const row = board.find((r) => r[1] === project.name);
        assert.equal(row[2], "Judge B; 1 not yet assigned");
        assert.equal(row[3], [15, 10, 5, 0, 0][i]);
        assert.equal(row[4], "");
        assert.equal(row[6], row[3]);
    }
    assert.equal(h.privateBook.tabs["Judge Notes"].data[1][5], "Finished");
    h.sourceBook.tabs.Judges.data[1][0] = "Replacement";
    h.context.computeResults();
    assert.ok(h.privateBook.tabs["Review Board"].data[0].includes("Replacement"));
    assert.ok(!h.privateBook.tabs["Review Board"].data[0].includes("Judge A"), "rename the existing judge, not a second column");
    assert.equal(h.privateBook.tabs["Judge Notes"].data[1][2], "Replacement");
    assert.doesNotMatch(JSON.stringify(h.request("config", "Judge B")), /Working prototype|Review Board|Judge Notes/);
    assert.doesNotMatch(JSON.stringify(h.sourceBook.tabs.Expo.data), /Working prototype|Total points/);
});

test("judge renames preserve assignments, points, notes, and distinct-review coverage", () => {
    const h = backend(10);
    const completed = finish(h).set;
    const active = h.request("claim").tablesets.find((s) => !s.complete);
    const before = plain(h.privateBook.tabs["Review Board"].data.slice(1).map((r) => r[3]));
    h.sourceBook.tabs.Judges.data[1][0] = "Alex Renamed";
    h.context.computeResults();
    const response = h.request("config", "Alex Renamed");
    assert.equal(response.ok, true, response.error);
    assert.deepEqual(response.tablesets.map((s) => s.id), [completed.id, active.id]);
    assert.equal(response.scores.length, 5);
    assert.equal(h.request("config", "Judge A").ok, false);
    assert.deepEqual(plain(h.privateBook.tabs["Review Board"].data.slice(1).map((r) => r[3])), before);
    assert.ok(h.privateBook.tabs.Tablesets.data.slice(1).every((r) => r[2] === "Alex Renamed"));
    assert.equal(h.request("submit", "Alex Renamed", { entry: { tableset: active.id, project: active.projects[0].id, scores: rubric(), notes: "Still mine" } }).entry.notes, "Still mine");
    assert.ok(!JSON.stringify(response).includes("judgeId"));
});

test("bulk name swaps and whole-row sorting keep scores with stable judge IDs", () => {
    const h = backend(5);
    const a = finish(h, "Judge A").set;
    const b = h.request("config", "Judge B").tablesets[0];
    const roster = h.sourceBook.tabs.Judges.data;
    [roster[1][0], roster[2][0]] = [roster[2][0], roster[1][0]];
    [roster[1], roster[2]] = [roster[2], roster[1]];
    h.context.computeResults();
    assert.equal(h.request("config", "Judge B").tablesets[0].id, a.id);
    assert.equal(h.request("config", "Judge A").tablesets[0].id, b.id);
    assert.equal(h.request("config", "Judge B").scores.length, 5);
    const stable = structuredClone(h.privateBook.tabs.Tablesets.data);
    roster[2][0] = roster[1][0];
    assert.throws(() => h.context.computeResults(), /unique/);
    assert.deepEqual(plain(h.privateBook.tabs.Tablesets.data), plain(stable), "duplicate names fail before ownership writes");
});

test("point colors exclude blank cells and remain idempotent on refresh", () => {
    const h = backend(5);
    finish(h);
    h.context.computeResults();
    h.context.computeResults();
    const rules = h.privateBook.tabs["Review Board"].rules;
    assert.equal(rules.length, 4);
    for (const [i, points] of [15, 10, 5, 0].entries()) {
        assert.ok(rules[i].formula.includes("ISNUMBER(D2)"));
        assert.ok(rules[i].formula.includes("D2=" + points + ","));
        assert.equal(rules[i].ranges[0].getNumColumns(), 3);
    }
    assert.equal(new Set(rules.map((r) => r.background)).size, 4);
});

test("legacy judge IDs backfill without changing rubric scores, notes, or timestamps", () => {
    const h = backend(5);
    finish(h);
    for (const sheet of [h.sourceBook.tabs.Judges, h.privateBook.tabs.Tablesets, h.privateBook.tabs.Scores])
        sheet.data.forEach((r) => r.pop());
    const before = plain(h.privateBook.tabs.Scores.data);
    h.context.computeResults();
    assert.deepEqual(plain(h.privateBook.tabs.Scores.data.map((r) => r.slice(0, 12))), before);
    const id = h.sourceBook.tabs.Judges.data[1].at(-1);
    assert.equal(h.privateBook.tabs.Tablesets.data[1].at(-1), id);
    assert.ok(h.privateBook.tabs.Scores.data.slice(1).every((r) => r.at(-1) === id));
});

test("Results removes the redundant column and colors Pending/Completed without breaking ties", () => {
    const h = backend(5);
    const results = h.privateBook.tabs.Results;
    results.data[0].splice(4, 0, "Reviews required");
    results.data.slice(1).forEach((r) => r.splice(4, 0, 3));
    results.data[0].splice(8, 0, "Top 5 status");
    results.data.slice(1).forEach((r) => r.splice(8, 0, "PROVISIONAL"));
    h.context.computeResults();
    assert.equal(results.data[0].length, 9);
    assert.equal(results.data[0][2], "Table");
    assert.equal(h.sourceBook.tabs.Expo.data[0][0], "Table #");
    assert.equal(h.privateBook.tabs["Review Board"].data[0][0], "Table");
    assert.ok(!results.data[0].includes("Reviews required"));
    assert.equal(results.data[0][7], "Reviewed by");
    assert.ok(!results.data[0].some((header) => /top 5/i.test(header)));
    assert.ok(results.rules.some((r) => r.formula.includes('G2="Pending"') && r.background === "#fff2cc"));
    assert.ok(results.rules.some((r) => r.formula.includes('G2="Completed"') && r.background === "#c6e8d3"));
    assert.equal(results.rules.length, 2);
    const board = h.privateBook.tabs["Review Board"];
    assert.equal(board.getMaxColumns(), 7, "three judge columns plus four report columns");
    h.sourceBook.tabs.Judges.data.push(["New Judge"]);
    h.context.computeResults();
    assert.equal(board.getMaxColumns(), 8, "new judges still get columns automatically");
});

test("live edit handler ignores other sheets and refreshes Judges edits", () => {
    const h = backend(5);
    const id = "1e7VEti7X3wOMY8BUuunV2pPakoqeuaP2rDj5lu060l0";
    h.sourceBook.tabs.Judges.data[1][0] = "Live Name";
    const event = (tab) => ({ source: { getId: () => id }, range: { getSheet: () => ({ getName: () => tab }) } });
    h.context.refreshJudgeNamesOnEdit(event("Expo"));
    assert.equal(h.privateBook.tabs["Review Board"].data[0][3], "Judge A");
    h.context.refreshJudgeNamesOnEdit(event("Judges"));
    assert.equal(h.privateBook.tabs["Review Board"].data[0][3], "Live Name");
    const written = h.privateBook.tabs["Review Board"].data;
    h.context.refreshJudgeNamesOnEdit(event("Judges"));
    assert.equal(h.privateBook.tabs["Review Board"].data, written, "duplicate queued edits do not rebuild reports");
    h.properties.JUDGING_REPORTED_ROSTER = "previous report";
    h.context.refreshJudgeNamesOnEdit(event("Judges"));
    assert.notEqual(h.privateBook.tabs["Review Board"].data, written, "retry a report that did not finish");
});

test("Expo table edits refresh all reports and preserve saved judging work", () => {
    const h = backend(5);
    const set = h.request("config").tablesets[0];
    const project = set.projects[0];
    h.request("submit", "Judge A", { entry: { tableset: set.id, project: project.id, scores: rubric(), notes: "Keep this feedback" } });
    const saved = plain(h.privateBook.tabs.Scores.data);
    const row = h.sourceBook.tabs.Expo.data.find((r) => r[4] === project.id);
    row[0] = 155;
    h.privateBook.tabs.Results.deleteColumn(3);
    const event = { source: { getId: () => "1e7VEti7X3wOMY8BUuunV2pPakoqeuaP2rDj5lu060l0" },
        range: { getSheet: () => ({ getName: () => "Expo" }) } };
    h.context.refreshJudgeNamesOnEdit(event);
    assert.equal(h.privateBook.tabs.Results.data[0][2], "Table");
    assert.equal(h.privateBook.tabs.Results.data.find((r) => r[1] === project.name)[2], "155");
    assert.equal(h.privateBook.tabs["Review Board"].data.find((r) => r[1] === project.name)[0], "155");
    assert.equal(h.privateBook.tabs["Judge Notes"].data[1][0], "155");
    assert.deepEqual(plain(h.privateBook.tabs.Scores.data), saved);
    assert.equal(h.request("config").tablesets[0].projects.find((p) => p.id === project.id).table, "155");
    const report = h.privateBook.tabs.Results.data;
    h.context.refreshJudgeNamesOnEdit(event);
    assert.equal(h.privateBook.tabs.Results.data, report, "queued duplicate edits skip report rewrites");
});

test("Expo names and additions/removals resize reports without deleting saved reviews", () => {
    const h = backend(5);
    finish(h);
    const saved = plain(h.privateBook.tabs.Scores.data);
    const assigned = plain(h.privateBook.tabs.Tablesets.data);
    h.sourceBook.tabs.Expo.data[1][1] = "Renamed project";
    h.sourceBook.tabs.Expo.data.push([99, "New project", "", ""]);
    const source = { getId: () => "1e7VEti7X3wOMY8BUuunV2pPakoqeuaP2rDj5lu060l0" };
    h.context.refreshJudgingStructure({ source, changeType: "INSERT_ROW" });
    for (const tab of ["Results", "Review Board"]) {
        assert.equal(h.privateBook.tabs[tab].data.length, 7);
        assert.ok(h.privateBook.tabs[tab].data.some((r) => r[1] === "Renamed project"));
    }
    h.sourceBook.tabs.Expo.data.splice(1, 1);
    h.context.refreshJudgingStructure({ source, changeType: "REMOVE_ROW" });
    for (const tab of ["Results", "Review Board"]) {
        assert.equal(h.privateBook.tabs[tab].data.length, 6);
        assert.ok(!h.privateBook.tabs[tab].data.some((r) => r[1] === "Renamed project"));
    }
    assert.deepEqual(plain(h.privateBook.tabs.Scores.data), saved);
    assert.equal(h.privateBook.tabs.Tablesets.data.length, assigned.length);
    h.sourceBook.tabs.Expo.data.splice(1);
    h.context.refreshJudgingStructure({ source, changeType: "REMOVE_ROW" });
    for (const tab of ["Results", "Review Board", "Judge Notes"])
        assert.equal(h.privateBook.tabs[tab].data.length, 1);
});

test("small remainder kept, incomplete results stay pending", () => {
    const h = backend(7);
    assert.equal(h.request("config", "Judge B").tablesets[0].projects.length, 5);
    finish(h, "Judge B");
    assert.equal(h.request("claim", "Judge B").tablesets[1].projects.length, 2);
    h.context.computeResults();
    assert.ok(h.privateBook.tabs.Results.data.slice(1).every((r) => r[6] === "Pending"));
});

test("ties share ranks, never use rubric totals, and leave decisions to organizers", () => {
    const h = backend();
    const projects = Array.from({ length: 6 }, (_, i) => ({ id: "p" + i, name: "Team " + i, table: i }));
    const sets = projects.flatMap((p, i) => ["A", "B", "C"].map((judge) => ({ id: "Set " + i + judge, judge,
        ranking: [p.id], projects: [p] })));
    const scores = sets.map((s, i) => ({ tableset: s.id, judge: s.judge, project: s.projects[0].id, total: 48 - i }));
    const results = plain(h.context.resultRows(sets, scores, projects));
    assert.ok(results.every((r) => r[0] === 1));
    assert.ok(results.every((r) => r.length === 9));
});

test("snapshot contains only judge-owned work and no private spreadsheet/roster/results", () => {
    const h = backend();
    h.request("config", "Judge B");
    const response = h.request("config");
    assert.deepEqual(Object.keys(response).sort(), ["assignmentMessage", "judge", "ok", "scores", "tablesets", "version"]);
    assert.doesNotMatch(JSON.stringify(response), /Judge B|private-phone|spreadsheet|finalist|top.?5/i);
    assert.equal(h.request("results").ok, false);
    h.setSharing("ANYONE_WITH_LINK");
    assert.equal(h.request("config").ok, false, "refuse public scoring workbook");
});

test("every project receives exactly three distinct reviews across random batches", () => {
    const h = backend(73);
    for (const judge of ["Judge A", "Judge B", "Judge C"]) {
        const seen = new Set();
        for (let batch = 0; batch < 20; batch++) {
            const response = h.request("claim", judge);
            assert.equal(response.ok, true, response.error);
            const active = response.tablesets.find((s) => !s.complete);
            if (!active) break;
            assert.ok(active.projects.length > 0 && active.projects.length <= 5);
            for (const project of active.projects) {
                assert.equal(seen.has(project.id), false, "a judge never reviews a project twice");
                seen.add(project.id);
            }
            finish(h, judge);
        }
        assert.equal(seen.size, 73);
    }
    const projects = h.context.readProjects();
    const all = h.context.sets(h.privateBook);
    for (const row of h.context.reviewCoverage(projects, all).values()) {
        assert.equal(row.assigned.length, 3);
        assert.equal(row.complete.length, 3);
        assert.equal(new Set(row.complete.map((r) => r.judge)).size, 3);
    }
    assert.equal(h.privateBook.tabs.Scores.data.length - 1, 219);
    const results = h.privateBook.tabs.Results.data.slice(1);
    assert.equal(results.length, 73, "one result row per project, not per review");
    assert.ok(results.every((r) => r[3] === 3 && r[6] === "Completed" && r[4] <= 45));
    assert.equal(results.reduce((sum, row) => sum + row[4], 0), 15 * 30 * 3);
    assert.match(h.request("claim").assignmentMessage, /three completed/);
});

test("84 projects and 19 judges finish with exactly 252 reviews and no fourth assignments", () => {
    const h = backend(84);
    const judges = Array.from({ length: 19 }, (_, i) => "Event Judge " + (i + 1));
    h.sourceBook.tabs.Judges.data = [["Name"], ...judges.map((name) => [name])];
    h.context.preassignFirstRound(false);
    let finished = 0;
    for (let round = 0; round < 20; round++) {
        let worked = false;
        for (const judge of judges) {
            const response = h.request("claim", judge);
            assert.equal(response.ok, true, response.error);
            if (!response.tablesets.some((set) => !set.complete)) continue;
            finished += finish(h, judge).set.projects.length;
            worked = true;
        }
        if (!worked) break;
    }
    assert.equal(finished, 252);
    for (const row of h.context.reviewCoverage(h.context.readProjects(), h.context.sets(h.privateBook)).values()) {
        assert.equal(row.assigned.length, 3);
        assert.equal(row.complete.length, 3);
        assert.equal(new Set(row.complete.map((review) => review.judge)).size, 3);
    }
    const before = plain(h.privateBook.tabs.Tablesets.data);
    for (const judge of judges) {
        const response = h.request("claim", judge);
        assert.equal(response.ok, true, response.error);
        assert.match(response.assignmentMessage, /Every project has three completed reviews/);
        assert.ok(response.tablesets.every((set) => set.complete));
    }
    assert.deepEqual(plain(h.privateBook.tabs.Tablesets.data), before);
    assert.equal(h.privateBook.tabs.Scores.data.length - 1, 252);
});

test("reservations count toward the three-review cap before any judge finishes", () => {
    const h = backend(5);
    h.sourceBook.tabs.Judges.appendRow(["Judge D"]);
    for (const judge of ["Judge A", "Judge B", "Judge C"]) assert.equal(h.request("config", judge).tablesets.length, 1);
    const fourth = h.request("config", "Judge D");
    assert.equal(fourth.tablesets.length, 0);
    assert.match(fourth.assignmentMessage, /already assigned/);
    assert.equal(h.privateBook.tabs.Tablesets.data.length, 4);
    const expo = h.sourceBook.tabs.Expo.data;
    const headers = expo[0];
    assert.equal(expo[1][headers.indexOf("Judging reviews complete")], 0);
    assert.match(expo[1][headers.indexOf("Judging in progress")], /Judge A, Judge B, Judge C/);
    assert.equal(expo[1][headers.indexOf("Reviews Remaining")], 3);
    finish(h, "Judge A");
    assert.equal(expo[1][headers.indexOf("Judging reviews complete")], 1);
    assert.equal(expo[1][headers.indexOf("Judging reviewed by")], "Judge A");
    assert.equal(expo[1][headers.indexOf("Judging reviews remaining")], 2);
    assert.equal(expo[1][headers.indexOf("Reviews Remaining")], 2);
    assert.equal(h.request("claim", "Judge D").tablesets.length, 0);
});

test("shuffle is not table order, existing completed reviews survive, and duplicate tables are flagged", () => {
    const h = backend(10);
    vm.runInContext("Math.random = () => 0;", h.context);
    const set = h.request("config").tablesets[0];
    assert.notDeepEqual(plain(set.projects.map((p) => p.table)), ["1", "2", "3", "4", "5"]);
    finish(h);
    const before = structuredClone(h.privateBook.tabs.Tablesets.data);
    h.sourceBook.tabs.Expo.data[2][0] = h.sourceBook.tabs.Expo.data[1][0];
    h.context.buildTablesets();
    assert.equal(h.privateBook.tabs.Tablesets.data[1][3], before[1][3]);
    assert.equal(h.privateBook.tabs.Scores.data.length, 6);
    const headers = h.sourceBook.tabs.Expo.data[0];
    assert.equal(h.sourceBook.tabs.Expo.data[1][headers.indexOf("Judging table check")], "DUPLICATE TABLE");
    assert.equal(h.sourceBook.tabs.Expo.data[1][0], 1, "source table numbers are never invented or renumbered");
});

test("server refuses a ranking that contradicts saved rubric totals", () => {
    const h = backend(2);
    const set = h.request("config").tablesets[0];
    set.projects.forEach((p, i) => h.request("submit", "Judge A", { entry: { tableset: set.id, project: p.id, scores: rubric(i ? 12 : 1) } }));
    assert.equal(h.request("complete", "Judge A", { tableset: set.id, ranking: set.projects.map((p) => p.id) }).ok, false);
    assert.equal(h.request("complete", "Judge A", { tableset: set.id, ranking: set.projects.map((p) => p.id).reverse() }).ok, true);
});

test("live project rename and table move retain score via stable ID; new projects append without stealing work", () => {
    const h = backend(5);
    const set = h.request("config").tablesets[0];
    const project = set.projects[0];
    h.request("submit", "Judge A", { entry: { tableset: set.id, project: project.id, scores: rubric() } });
    const sourceRow = h.sourceBook.tabs.Expo.data.find((r) => r[4] === project.id);
    sourceRow[0] = "99";
    sourceRow[1] = "Renamed project";
    h.sourceBook.tabs.Expo.appendRow([100, "New project"]);
    const refreshed = h.request("config");
    assert.equal(refreshed.tablesets[0].projects[0].name, "Renamed project");
    assert.equal(refreshed.tablesets[0].projects[0].table, "99");
    assert.equal(refreshed.scores[0].project, project.id);
    assert.equal(refreshed.tablesets[0].projects.length, 5);
    assert.equal(h.request("config", "Judge B").tablesets[0].projects[0].name, "New project");
    const before = structuredClone(h.privateBook.tabs.Tablesets.data);
    h.context.buildTablesets();
    assert.deepEqual(h.privateBook.tabs.Tablesets.data, before, "prepare preserves existing assignments");
});

test("formula-like user content is stored literally and missing Expo rows fail safely", () => {
    const h = backend(5);
    const set = h.request("config").tablesets[0];
    const entry = { tableset: set.id, project: set.projects[0].id, scores: rubric(), notes: '=IMPORTDATA("bad")' };
    assert.equal(h.request("submit", "Judge A", { entry }).ok, true);
    assert.match(h.privateBook.tabs.Scores.data[1][10], /^'=/);
    h.sourceBook.tabs.Expo.data.splice(1, 1);
    assert.equal(h.request("config").ok, false);
});

test("frontend never embeds source ID or publishes standings; rubric language retained", () => {
    const js = readFileSync(new URL("../judging/judging.js", import.meta.url), "utf8");
    const html = readFileSync(new URL("../judging/index.html", import.meta.url), "utf8");
    assert.doesNotMatch(js + html, /1e7VEti7X3wOMY8BUuunV2pPakoqeuaP2rDj5lu060l0|docs\.google\.com\/spreadsheets|top five|top 5/i);
    assert.match(js, /Account for how much of the work was done by AI/);
    assert.match(js, /setInterval\(refresh, 120000 \+ Math.floor\(Math.random\(\) \* 30000\)\)/);
    assert.match(html, /name="invitation"/);
    assert.doesNotMatch(html, /Calibration|Finalists|Exec panel/);
});

test("Devpost CSV importer preserves existing Expo rows, appends new projects, and refuses active sets", () => {
    const h = backend(5);
    const fixture = [["Project Title", "Project URL", "Table Number"], ["Project 1", "https://devpost.com/software/existing", "1"],
        ["New import", "https://devpost.com/software/new", ""], ["New import", "https://devpost.com/software/new", ""]];
    h.context.Utilities.parseCsv = () => fixture.map((r) => [...r]);
    h.context.DriveApp.getFileById = () => ({ getSharingAccess: () => "PRIVATE", getBlob: () => ({ getDataAsString: () => "mock CSV" }) });
    h.context.SpreadsheetApp.getUi = () => ({ ButtonSet: { OK_CANCEL: "okcancel" }, Button: { OK: "ok" },
        prompt: () => ({ getSelectedButton: () => "ok", getResponseText: () => "csv-file" }) });
    h.request("config");
    assert.throws(() => h.context.importDevpostCsv(), /Import before judging/);
    h.privateBook.tabs.Tablesets.data = [h.privateBook.tabs.Tablesets.data[0]];
    const original = structuredClone(h.sourceBook.tabs.Expo.data);
    h.context.importDevpostCsv();
    assert.deepEqual(h.sourceBook.tabs.Expo.data.slice(0, original.length), original);
    assert.equal(h.sourceBook.tabs.Expo.data.length, original.length + 1);
    assert.deepEqual(h.sourceBook.tabs.Expo.data.at(-1).slice(0, 3), ["6", "New import", "https://devpost.com/software/new"]);
    h.context.importDevpostCsv();
    assert.equal(h.sourceBook.tabs.Expo.data.length, original.length + 1, "repeat import does not duplicate");
});
