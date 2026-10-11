import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../judging/apps-script.gs", import.meta.url), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

class Sheet {
    constructor(data = []) { this.data = structuredClone(data); this.maxColumns = 34; }
    getLastRow() { return this.data.length; }
    getLastColumn() { return Math.max(1, ...this.data.map((r) => r.length)); }
    getMaxColumns() { return this.maxColumns; }
    insertColumnAfter() { this.maxColumns++; }
    getDataRange() { return this.getRange(1, 1, Math.max(1, this.data.length), this.getLastColumn()); }
    getRange(row, col, height = 1, width = 1) {
        return {
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
        };
    }
    appendRow(row) { this.data.push([...row]); }
    clearContents() { this.data = []; }
    setFrozenRows() {}
}
class Book {
    constructor(data = {}) { this.tabs = Object.fromEntries(Object.entries(data).map(([name, values]) => [name, new Sheet(values)])); }
    getSheetByName(name) { return this.tabs[name] || null; }
    insertSheet(name) { return this.tabs[name] = new Sheet(); }
    toast() {}
    getId() { return "private"; }
    getUrl() { return "private-workbook"; }
}
function backend(count = 15) {
    const sourceBook = new Book({
        Judges: [["Name", "Phone Number"], ["Judge A", "private-phone"], ["Judge B"], ["Judge C"]],
        Expo: [["Table #", "Project Name", "Project Link", "Track"], ...Array.from({ length: count }, (_, i) => [i + 1, "Project " + (i + 1), "", ""])],
    });
    const privateBook = new Book();
    const properties = {};
    let held = false, lockCount = 0, uuid = 0, sharing = "PRIVATE";
    const context = vm.createContext({
        SpreadsheetApp: {
            openById: (id) => id === "private" ? privateBook : sourceBook,
            create: () => privateBook,
            getActiveSpreadsheet: () => sourceBook,
            getUi: () => ({ alert() {} }),
        },
        PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties[key], setProperty: (key, value) => { properties[key] = value; } }) },
        DriveApp: { Access: { PRIVATE: "PRIVATE" }, getFileById: () => ({ getSharingAccess: () => sharing }) },
        Utilities: { getUuid: () => "project-id-" + (++uuid) },
        LockService: { getScriptLock: () => ({ waitLock() { assert.equal(held, false, "no nested lock"); held = true; lockCount++; }, releaseLock() { held = false; } }) },
        ContentService: { MimeType: { JSON: "json" }, createTextOutput: (value) => ({ setMimeType: () => JSON.parse(value) }) },
    });
    vm.runInContext(source, context);
    context.setup();
    context.buildTablesets();
    const request = (action, judge = "Judge A", extra = {}) => context.doPost({ postData: { contents: JSON.stringify({ version: "tablesets-v1", invitation: "Invitation", judge, action, ...extra }) } });
    return { context, request, sourceBook, privateBook, properties, setSharing: (value) => { sharing = value; }, lockCount: () => lockCount };
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

test("roster and Invitation are both required; legacy requests fail closed", () => {
    const h = backend();
    assert.equal(h.request("config", " Judge   A ").judge.name, "Judge A");
    assert.equal(h.request("config", "Unlisted Judge").ok, false);
    assert.equal(h.request("config", "Judge B", { invitation: "wrong" }).ok, false);
    assert.equal(h.request("config", "Judge B", { version: "old" }).ok, false);
    h.sourceBook.tabs.Judges.data[1][0] = "Removed";
    assert.equal(h.request("config", "Judge A").ok, false);
});

test("claims are locked, exclusive, idempotent, and limited to one unfinished set", () => {
    const h = backend();
    const a = h.request("config");
    const b = h.request("config", "Judge B");
    assert.equal(a.tablesets[0].projects.length, 5);
    assert.notEqual(a.tablesets[0].id, b.tablesets[0].id);
    assert.equal(h.request("claim").tablesets.length, 1);
    assert.equal(h.request("config").tablesets[0].id, a.tablesets[0].id);
    assert.ok(h.lockCount() >= 9);
    finish(h);
    assert.equal(h.request("claim").tablesets.length, 2);
    assert.equal(h.request("claim").tablesets.length, 2);
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
    assert.deepEqual(h.privateBook.tabs.Results.data.slice(1).map((r) => r[5]), [15, 10, 5, 0, 0]);
    assert.equal(h.request("claim").tablesets.length, 1, "no completed set reassigned");
});

test("small remainder kept, provisional results stay provisional", () => {
    const h = backend(7);
    assert.equal(h.request("config", "Judge B").tablesets[0].projects.length, 5);
    assert.equal(h.request("config", "Judge C").tablesets[0].projects.length, 2);
    h.context.computeResults();
    assert.ok(h.privateBook.tabs.Results.data.slice(1).every((r) => r[8].startsWith("PROVISIONAL")));
});

test("ties share ranks, never use rubric totals, and flag top-five cutoff for organizers", () => {
    const h = backend();
    const sets = Array.from({ length: 6 }, (_, i) => ({ id: "Set " + i, ranking: ["p" + i], projects: [{ id: "p" + i, name: "Team " + i, table: i }] }));
    const scores = sets.map((s, i) => ({ tableset: s.id, project: "p" + i, total: 48 - i }));
    const results = plain(h.context.resultRows(sets, scores));
    assert.ok(results.every((r) => r[0] === 1));
    assert.ok(results.every((r) => r[8].startsWith("TIED FOR TOP 5")));
});

test("snapshot contains only judge-owned work and no private spreadsheet/roster/results", () => {
    const h = backend();
    h.request("config", "Judge B");
    const response = h.request("config");
    assert.deepEqual(Object.keys(response).sort(), ["judge", "ok", "scores", "tablesets", "version"]);
    assert.doesNotMatch(JSON.stringify(response), /Judge B|private-phone|spreadsheet|finalist|top.?5/i);
    assert.equal(h.request("results").ok, false);
    h.setSharing("ANYONE_WITH_LINK");
    assert.equal(h.request("config").ok, false, "refuse public scoring workbook");
});

test("live project rename and table move retain score via stable ID; new projects append without stealing work", () => {
    const h = backend(5);
    const set = h.request("config").tablesets[0];
    const project = set.projects[0];
    h.request("submit", "Judge A", { entry: { tableset: set.id, project: project.id, scores: rubric() } });
    h.sourceBook.tabs.Expo.data[1][0] = "99";
    h.sourceBook.tabs.Expo.data[1][1] = "Renamed project";
    h.sourceBook.tabs.Expo.appendRow([100, "New project"]);
    const refreshed = h.request("config");
    assert.equal(refreshed.tablesets[0].projects[0].name, "Renamed project");
    assert.equal(refreshed.tablesets[0].projects[0].table, "99");
    assert.equal(refreshed.scores[0].project, project.id);
    assert.equal(refreshed.tablesets[0].projects.length, 5);
    assert.equal(h.request("config", "Judge B").tablesets[0].projects[0].name, "New project");
    assert.throws(() => h.context.buildTablesets(), /Judging has started/);
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
    assert.match(js, /setInterval\(refresh, 30000\)/);
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
    assert.throws(() => h.context.importDevpostCsv(), /Import before building/);
    h.privateBook.tabs.Tablesets.data = [h.privateBook.tabs.Tablesets.data[0]];
    const original = structuredClone(h.sourceBook.tabs.Expo.data);
    h.context.importDevpostCsv();
    assert.deepEqual(h.sourceBook.tabs.Expo.data.slice(0, original.length), original);
    assert.equal(h.sourceBook.tabs.Expo.data.length, original.length + 1);
    assert.deepEqual(h.sourceBook.tabs.Expo.data.at(-1).slice(0, 3), ["6", "New import", "https://devpost.com/software/new"]);
    h.context.importDevpostCsv();
    assert.equal(h.sourceBook.tabs.Expo.data.length, original.length + 1, "repeat import does not duplicate");
});
