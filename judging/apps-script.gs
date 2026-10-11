/**
 * Bind to the organizer's source sheet. Run setup(), then buildTablesets().
 * Deploy as web app, execute as the organizer, accessible to Anyone.
 * Source spreadsheet ID and invitation stay server-side, not in browser data.
 * Scoring workbook MUST be Restricted and never published. Source ID stays server-side.
 * See judging/README.md for deployment and migration.
 */
const VERSION = "tablesets-v1";
const SOURCE_SPREADSHEET_ID = "1e7VEti7X3wOMY8BUuunV2pPakoqeuaP2rDj5lu060l0";
const CRITERIA = { innovation: .25, functionality: .3, creativity: .25, theme: .1, technical: .1 };
const POINTS = [15, 10, 5, 0, 0];
const TABS = {
  Tablesets: ["id", "projects", "judge", "ranking", "completedAt"],
  Scores: ["id", "judge", "tableset", "project", ...Object.keys(CRITERIA), "total", "notes", "updatedAt"],
};
function onOpen() {
  SpreadsheetApp.getUi().createMenu("hackPHS Judging")
    .addItem("Set up private judging", "setup")
    .addItem("Build tablesets from Expo", "buildTablesets")
    .addItem("Refresh private results / top five", "computeResults")
    .addItem("Import Devpost CSV from Drive", "importDevpostCsv").addToUi();
}
function restrictedBook(property) {
  const id = PropertiesService.getScriptProperties().getProperty(property);
  if (!id) throw new Error("An organizer must run setup first.");
  if (DriveApp.getFileById(id).getSharingAccess() !== DriveApp.Access.PRIVATE) {
    throw new Error("Judging paused: spreadsheets must have Restricted sharing. Contact an organizer.");
  }
  return SpreadsheetApp.openById(id);
}
function sourceBook() {
  return SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
}
function privateBook() { return restrictedBook("JUDGING_PRIVATE_SHEET_ID"); }
function norm(value) { return String(value == null ? "" : value).trim().toLowerCase().replace(/\s+/g, " "); }
function text(value) { return String(value == null ? "" : value).trim(); }
// Treat project names and notes as literal text, never formulas.
function literal(value) { return typeof value === "string" && /^[=+@-]/.test(value) ? "'" + value : value; }
function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function rows(book, name) {
  const sheet = book.getSheetByName(name);
  if (!sheet) throw new Error("Missing " + name + " tab. Ask an organizer to run setup.");
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(norm);
  return values.slice(1).map((row, i) => Object.assign({ _row: i + 2 },
    Object.fromEntries(headers.map((h, j) => [h, row[j]]))))
    .filter((row) => headers.some((h) => row[h] !== ""));
}
function writeTab(book, name, headers, data) {
  const sheet = book.getSheetByName(name) || book.insertSheet(name);
  sheet.clearContents();
  sheet.getRange(1, 1, data.length + 1, headers.length)
    .setValues([headers, ...data].map((row) => row.map(literal)));
  sheet.setFrozenRows(1);
}
function readProjects() {
  const source = sourceBook();
  const sheet = source.getSheetByName("Expo");
  if (!sheet) throw new Error("Missing Expo tab.");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(norm);
  let idColumn = headers.indexOf("judging id") + 1;
  if (!idColumn) {
    idColumn = headers.length + 1;
    if (idColumn > sheet.getMaxColumns()) sheet.insertColumnAfter(sheet.getMaxColumns());
    sheet.getRange(1, idColumn).setValue("Judging ID");
  }
  const seen = new Set();
  const ids = new Set();
  const projects = rows(source, "Expo").filter((r) => text(r["project name"])).map((r) => {
    const name = text(r["project name"]);
    const table = text(r["project table"] || r["table #"] || r.table);
    if (!table) throw new Error("Missing table in Expo for " + name);
    if (seen.has(norm(name))) throw new Error("Duplicate project name in Expo: " + name);
    seen.add(norm(name));
    let id = text(r["judging id"]);
    if (!id) { id = Utilities.getUuid(); sheet.getRange(r._row, idColumn).setValue(id); }
    if (ids.has(id)) throw new Error("Duplicate Judging ID in Expo. Contact an organizer.");
    ids.add(id);
    return { id, name, table, link: text(r["project link"]), tracks: text(r.track) };
  });
  if (!projects.length) throw new Error("Expo has no projects. Check Project Name and Table # headers.");
  return projects.sort((a, b) => a.table.localeCompare(b.table, undefined, { numeric: true }) || a.name.localeCompare(b.name));
}
function authenticate(request) {
  const invitation = PropertiesService.getScriptProperties().getProperty("JUDGE_INVITATION");
  if (!invitation || text(request.invitation) !== invitation) throw new Error("That password isn't right.");
  const name = norm(request.judge);
  const matches = rows(sourceBook(), "Judges").filter((r) => name && norm(r.name) === name);
  if (matches.length !== 1) throw new Error("Your name must match one unique Name in the Judges tab. Ask an organizer for help.");
  return { name: text(matches[0].name) };
}
function sets(book) {
  return rows(book, "Tablesets").map((r) => ({ ...r, projects: JSON.parse(r.projects),
    ranking: r.ranking ? JSON.parse(r.ranking) : [] }));
}
function ownedSet(book, judge, id) {
  const set = sets(book).find((s) => s.id === id && norm(s.judge) === norm(judge.name));
  if (!set) throw new Error("This tableset is not assigned to you.");
  return set;
}
function claim(judge, initial) {
  return withLock(() => {
    const book = privateBook();
    syncProjects(book);
    const all = sets(book);
    const mine = all.filter((s) => norm(s.judge) === norm(judge.name));
    if (mine.some((s) => !s.ranking.length) || (initial && mine.length)) return;
    // All claim, score, and completion writes share a lock. Completed sets stay closed.
    const next = all.find((s) => !text(s.judge));
    if (next) book.getSheetByName("Tablesets").getRange(next._row, 3).setValue(literal(judge.name));
  });
}
function snapshot(judge) {
  return withLock(() => {
  const book = privateBook();
  syncProjects(book);
  const mine = sets(book).filter((s) => norm(s.judge) === norm(judge.name));
  const ids = new Set(mine.map((s) => s.id));
  // Explicit allowlist: no other judges, overall results, or top-five markers leave the server.
  return { version: VERSION, judge, tablesets: mine.map((s) => ({ id: s.id, projects: s.projects,
    ranking: s.ranking, complete: !!s.ranking.length })),
    scores: rows(book, "Scores").filter((r) => norm(r.judge) === norm(judge.name) && ids.has(r.tableset))
      .map((r) => ({ id: r.id, tableset: r.tableset, project: r.project,
        scores: Object.fromEntries(Object.keys(CRITERIA).map((key) => [key, Number(r[key])])),
        total: Number(r.total), notes: text(r.notes) })) };
  });
}
// Stable IDs allow names/tables to change without moving a judge's saved scores.
// Read current Expo values at each refresh; new projects fill unclaimed sets only.
function syncProjects(book) {
  const projects = readProjects();
  const byId = new Map(projects.map((p) => [p.id, p]));
  const all = sets(book);
  if (!all.length) throw new Error("An organizer must build tablesets before judging starts.");
  const original = new Map(all.map((set) => [set.id, JSON.stringify(set.projects)]));
  const seen = new Set();
  for (const set of all) {
    set.projects = set.projects.map((p) => {
      const current = byId.get(p.id);
      if (!current) throw new Error("An assigned Expo project was removed. Ask an organizer to restore it.");
      seen.add(p.id);
      return current;
    });
  }
  const added = projects.filter((p) => !seen.has(p.id));
  if (added.length && book.getSheetByName("Results")) book.getSheetByName("Results").clearContents();
  for (const set of all.filter((s) => !text(s.judge))) {
    while (set.projects.length < 5 && added.length) set.projects.push(added.shift());
  }
  const sheet = book.getSheetByName("Tablesets");
  for (const set of all) {
    const serialized = JSON.stringify(set.projects);
    if (serialized !== original.get(set.id)) sheet.getRange(set._row, 2).setValue(serialized);
  }
  while (added.length) {
    const id = "Set " + (all.length + 1);
    const group = added.splice(0, 5);
    sheet.appendRow([id, JSON.stringify(group), "", "", ""]);
    all.push({ id });
  }
}
function doPost(e) {
  let result;
  try {
    const request = JSON.parse(e.postData.contents);
    if (request.version !== VERSION) throw new Error("Judging has changed. Refresh this page before continuing.");
    const judge = authenticate(request);
    if (request.action === "config") { claim(judge, true); result = snapshot(judge); }
    else if (request.action === "claim") { claim(judge, false); result = snapshot(judge); }
    else if (request.action === "submit") result = { entry: submit(judge, request.entry) };
    else if (request.action === "complete") {
      complete(judge, request.tableset, request.ranking);
      computeResults();
      result = snapshot(judge);
    }
    else throw new Error("Unknown action.");
    result.ok = true;
  } catch (error) { result = { ok: false, error: error.message }; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
function validateScores(input) {
  const scores = {};
  let total = 0;
  for (const [key, weight] of Object.entries(CRITERIA)) {
    const score = input && input[key];
    if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 12)
      throw new Error("Score for " + key + " must be an integer from 1 to 12.");
    scores[key] = score;
    total += score * weight * 4;
  }
  return { scores, total: Math.round(total * 100) / 100 };
}
function submit(judge, entry) {
  return withLock(() => {
    if (!entry) throw new Error("Missing score.");
    const book = privateBook();
    const set = ownedSet(book, judge, entry.tableset);
    if (set.ranking.length) throw new Error("This tableset is complete; scores are locked.");
    if (!set.projects.some((p) => p.id === entry.project)) throw new Error("Project is not in your tableset.");
    const { scores, total } = validateScores(entry.scores);
    const id = JSON.stringify([set.id, entry.project]);
    const row = [id, judge.name, set.id, entry.project, ...Object.keys(CRITERIA).map((k) => scores[k]),
      total, text(entry.notes).slice(0, 5000), new Date()];
    const existing = rows(book, "Scores").find((r) => r.id === id);
    const sheet = book.getSheetByName("Scores");
    sheet.getRange(existing ? existing._row : sheet.getLastRow() + 1, 1, 1, row.length).setValues([row.map(literal)]);
    return { id, tableset: set.id, project: entry.project, scores, total, notes: row[row.length - 2] };
  });
}
function complete(judge, id, ranking) {
  return withLock(() => {
    const book = privateBook();
    const set = ownedSet(book, judge, id);
    if (!Array.isArray(ranking) || ranking.length !== set.projects.length || new Set(ranking).size !== ranking.length ||
        ranking.some((p) => !set.projects.some((project) => project.id === p)))
      throw new Error("Rank every project in your tableset exactly once.");
    if (set.ranking.length) {
      if (JSON.stringify(ranking) === JSON.stringify(set.ranking)) return; // Network retry.
      throw new Error("This tableset's ranking is already locked.");
    }
    const scores = rows(book, "Scores").filter((r) => r.tableset === id && norm(r.judge) === norm(judge.name));
    if (!set.projects.every((p) => scores.some((r) => r.project === p.id))) throw new Error("Save all rubric scores before ranking.");
    // One range write commits the whole ranking, avoiding partial point awards.
    book.getSheetByName("Tablesets").getRange(set._row, 4, 1, 2).setValues([[JSON.stringify(ranking), new Date()]]);
  });
}
function setup() {
  const props = PropertiesService.getScriptProperties();
  sourceBook();
  if (!props.getProperty("JUDGING_PRIVATE_SHEET_ID")) {
    const book = SpreadsheetApp.create("hackPHS 2026 - PRIVATE Judging");
    props.setProperty("JUDGING_PRIVATE_SHEET_ID", book.getId());
  }
  const book = privateBook();
  for (const [name, headers] of Object.entries(TABS)) {
    if (!book.getSheetByName(name)) writeTab(book, name, headers, []);
  }
  props.setProperty("JUDGE_INVITATION", "Invitation");
  SpreadsheetApp.getUi().alert("Private judging workbook: " + book.getUrl() +
    "\nKeep access restricted to organizers only. Do not publish it. Now run Build tablesets from Expo.");
}
function buildTablesets() {
  withLock(() => {
    const book = privateBook();
    if (sets(book).some((s) => text(s.judge)) || rows(book, "Scores").length)
      throw new Error("Judging has started. Do not rebuild tablesets; ask an organizer to migrate them.");
    const projects = readProjects();
    const data = [];
    for (let i = 0; i < projects.length; i += 5)
      data.push(["Set " + (data.length + 1), JSON.stringify(projects.slice(i, i + 5)), "", "", ""]);
    writeTab(book, "Tablesets", TABS.Tablesets, data);
    if (book.getSheetByName("Results")) book.getSheetByName("Results").clearContents();
    sourceBook().toast(data.length + " tablesets created. Last set has " + JSON.parse(data[data.length - 1][1]).length + " projects.");
  });
}
function resultRows(all, scores) {
  const finished = all.length > 0 && all.every((s) => s.ranking.length);
  const results = all.flatMap((s) => s.projects.map((p) => {
    const score = scores.find((r) => r.tableset === s.id && r.project === p.id);
    const place = s.ranking.indexOf(p.id);
    return { ...p, set: s.id, place: place < 0 ? "" : place + 1, points: place < 0 ? 0 : POINTS[place],
      total: score ? Number(score.total) : 0, complete: !!s.ranking.length };
  })).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  // Equal points stay tied. Rubric totals do NOT break ties; name only stabilizes display.
  let rank = 0;
  return results.map((r, i) => {
    if (!i || r.points !== results[i - 1].points) rank = i + 1;
    const tiedGroupEnd = results.filter((other) => other.points >= r.points).length - 1;
    const marker = !finished ? "PROVISIONAL - judging incomplete" :
      rank <= 5 && tiedGroupEnd >= 5 ? "TIED FOR TOP 5 - organizer decision needed" :
      rank <= 5 ? "TOP 5" : "";
    return [rank, r.name, r.table, r.set, r.place, r.points, r.total, r.complete ? "Complete" : "Pending", marker];
  });
}
function computeResults() {
  withLock(() => {
    const book = privateBook();
    syncProjects(book);
    writeTab(book, "Results", ["Rank (ties shared)", "Project", "Table", "Tableset", "Set place", "Points", "Rubric /48", "Status", "Top 5 (organizers only)"],
      resultRows(sets(book), rows(book, "Scores")));
    sourceBook().toast("Private results updated. Resolve cutoff ties in the private Results tab; nothing is sent to judges.");
  });
}
// Official Devpost CSV export. Import before building/claiming tablesets.
function importDevpostCsv() {
  const ui = SpreadsheetApp.getUi();
  const prompt = ui.prompt("Import Devpost projects", "Paste the Drive file ID of a completed-submissions CSV export. Existing Expo rows are preserved; new projects are appended.", ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  const csv = Utilities.parseCsv(DriveApp.getFileById(text(prompt.getResponseText())).getBlob().getDataAsString("UTF-8"));
  const headers = csv.shift().map((h) => norm(h).replace(/^\uFEFF/, ""));
  const column = (aliases) => headers.findIndex((h) => aliases.includes(h));
  const nameCol = column(["project name", "project title", "title", "name", "submission title"]);
  const linkCol = column(["project link", "project url", "url", "submission url"]);
  const tableCol = column(["project table", "table #", "table number", "table"]);
  if (nameCol < 0) throw new Error("CSV needs a Project Name or Project Title column.");
  withLock(() => {
    if (sets(privateBook()).length) throw new Error("Import before building tablesets. Existing sets are preserved.");
    const sheet = sourceBook().getSheetByName("Expo");
    const dest = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(norm);
    const destName = dest.indexOf("project name"), destLink = dest.indexOf("project link");
    const destTable = dest.findIndex((h) => ["table #", "project table", "table"].includes(h));
    if (destName < 0 || destTable < 0) throw new Error("Expo needs Project Name and Table # headers.");
    const existing = rows(sourceBook(), "Expo").filter((r) => text(r["project name"]));
    const names = new Set(existing.map((r) => norm(r["project name"])));
    const usedTables = new Set(existing.map((r) => text(r[dest[destTable]])));
    let nextTable = 1;
    const imported = [];
    for (const row of csv) {
      const name = text(row[nameCol]);
      if (!name || names.has(norm(name))) continue;
      names.add(norm(name));
      let table = tableCol < 0 ? "" : text(row[tableCol]);
      if (!table) { while (usedTables.has(String(nextTable))) nextTable++; table = String(nextTable++); }
      usedTables.add(table);
      const result = Array(dest.length).fill("");
      result[destName] = name;
      result[destTable] = table;
      if (destLink >= 0 && linkCol >= 0) result[destLink] = text(row[linkCol]);
      imported.push(result);
    }
    if (imported.length) sheet.getRange(Math.max(2, sheet.getLastRow() + 1), 1, imported.length, dest.length)
      .setValues(imported.map((row) => row.map(literal)));
    sourceBook().toast(imported.length + " projects appended. Review table numbers and remove sample rows, then Build tablesets from Expo.");
  });
}
