/**
 * Bind to the organizer's source sheet. Run setup(), then buildTablesets().
 * Deploy as web app, execute as the organizer, accessible to Anyone.
 * Source spreadsheet ID and invitation stay server-side, not in browser data.
 * Scoring workbook MUST be Restricted and never published. Source ID stays server-side.
 * See judging/README.md for deployment and migration.
 */
const VERSION = "tablesets-v2";
const SOURCE_SPREADSHEET_ID = "1e7VEti7X3wOMY8BUuunV2pPakoqeuaP2rDj5lu060l0";
const CRITERIA = { innovation: .25, functionality: .3, creativity: .25, theme: .1, technical: .1 };
const POINTS = [15, 10, 5, 0, 0];
const REVIEWS_PER_PROJECT = 3;
let requestBooks = null;
const PROGRESS_HEADERS = ["Judging reviews complete", "Judging reviewed by", "Judging in progress", "Judging reviews remaining", "Judging table check", "Reviews Remaining"];
const TABS = {
  Tablesets: ["id", "projects", "judge", "ranking", "completedAt", "judgeId"],
  Scores: ["id", "judge", "tableset", "project", ...Object.keys(CRITERIA), "total", "notes", "updatedAt", "judgeId"],
};
function onOpen() {
  SpreadsheetApp.getUi().createMenu("hackPHS Judging")
    .addItem("Set up private judging", "setup")
    .addItem("Prepare three-review judging", "buildTablesets")
    .addItem("Preassign first round", "preassignFirstRound")
    .addItem("Refresh review progress / private results", "computeResults")
    .addItem("Import Devpost CSV from Drive", "importDevpostCsv").addToUi();
}
function restrictedBook(property) {
  if (requestBooks && requestBooks[property]) return requestBooks[property];
  const id = PropertiesService.getScriptProperties().getProperty(property);
  if (!id) throw new Error("An organizer must run setup first.");
  if (DriveApp.getFileById(id).getSharingAccess() !== DriveApp.Access.PRIVATE) {
    throw new Error("Judging paused: spreadsheets must have Restricted sharing. Contact an organizer.");
  }
  const book = SpreadsheetApp.openById(id);
  if (requestBooks) requestBooks[property] = book;
  return book;
}
function sourceBook() {
  if (requestBooks && requestBooks.source) return requestBooks.source;
  const existing = requestBooks && requestBooks.JUDGING_PRIVATE_SHEET_ID;
  const book = existing && existing.getId() === SOURCE_SPREADSHEET_ID ? existing : SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
  if (requestBooks) requestBooks.source = book;
  return book;
}
function privateBook() { return restrictedBook("JUDGING_PRIVATE_SHEET_ID"); }
function norm(value) { return String(value == null ? "" : value).trim().toLowerCase().replace(/\s+/g, " "); }
function text(value) { return String(value == null ? "" : value).trim(); }
// Treat project names and notes as literal text, never formulas.
function literal(value) { return typeof value === "string" && /^[=+@-]/.test(value) ? "'" + value : value; }
function withLock(fn) {
  const lock = LockService.getScriptLock();
  if (requestBooks && requestBooks.retryBusy) {
    if (!lock.tryLock(1000)) {
      const error = new Error("Another judging update is saving. Please wait while we retry.");
      error.retryable = true;
      throw error;
    }
  } else lock.waitLock(20000);
  try { return fn(); }
  finally { try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); } }
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
  while (headers.length > sheet.getMaxColumns()) sheet.insertColumnAfter(sheet.getMaxColumns());
  sheet.clearContents();
  sheet.getRange(1, 1, data.length + 1, headers.length)
    .setValues([headers, ...data].map((row) => row.map(literal)));
  sheet.setFrozenRows(1);
}
function readProjects(reportOnly = false, readOnly = false) {
  const source = sourceBook();
  const sheet = source.getSheetByName("Expo");
  if (!sheet) throw new Error("Missing Expo tab.");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(norm);
  let idColumn = headers.indexOf("judging id") + 1;
  const projectRows = rows(source, "Expo");
  if (readOnly && (!idColumn || projectRows.some((r) => text(r["project name"]) && !text(r["judging id"]))))
    return withLock(() => readProjects(reportOnly));
  if (!idColumn) {
    idColumn = headers.length + 1;
    if (idColumn > sheet.getMaxColumns()) sheet.insertColumnAfter(sheet.getMaxColumns());
    sheet.getRange(1, idColumn).setValue("Judging ID");
  }
  const seen = new Set();
  const ids = new Set();
  const projects = projectRows.filter((r) => text(r["project name"])).map((r) => {
    const name = text(r["project name"]);
    const table = text(r["project table"] || r["table #"] || r.table);
    if (!table && !reportOnly) throw new Error("Missing table in Expo for " + name);
    if (seen.has(norm(name))) throw new Error("Duplicate project name in Expo: " + name);
    seen.add(norm(name));
    let id = text(r["judging id"]);
    if (!id) { id = Utilities.getUuid(); sheet.getRange(r._row, idColumn).setValue(id); }
    if (ids.has(id)) throw new Error("Duplicate Judging ID in Expo. Contact an organizer.");
    ids.add(id);
    return { id, name, table, link: text(r["project link"]), tracks: text(r.track) };
  });
  if (!projects.length && !reportOnly) throw new Error("Expo has no projects. Check Project Name and Table # headers.");
  return projects.sort((a, b) => a.table.localeCompare(b.table, undefined, { numeric: true }) || a.name.localeCompare(b.name));
}
// Call under the script lock. IDs survive name edits and whole-row sorting.
function syncJudgeNames(book) {
  const sheet = sourceBook().getSheetByName("Judges");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(norm);
  if (!headers.includes("name")) throw new Error("Judges needs a Name header.");
  const idColumn = headers.indexOf("judging judge id") + 1 || headers.length + 1;
  const roster = rows(sourceBook(), "Judges").filter((r) => text(r.name)).map((r) =>
    ({ name: text(r.name), id: text(r["judging judge id"]) || Utilities.getUuid(), row: r._row,
      existingId: text(r["judging judge id"]) }));
  if (new Set(roster.map((r) => norm(r.name))).size !== roster.length || new Set(roster.map((r) => r.id)).size !== roster.length)
    throw new Error("Each judge needs a unique Name and Judging Judge ID. Fix the Judges tab before continuing.");
  const props = PropertiesService.getScriptProperties();
  const signature = JSON.stringify([book.getId(), roster.map((r) => [r.id, r.name])]);
  if (roster.every((r) => r.existingId) && props.getProperty("JUDGING_ROSTER_SIGNATURE") === signature)
    return { roster, changed: false };
  const byId = new Map(roster.map((r) => [r.id, r]));
  const byName = new Map(roster.map((r) => [norm(r.name), r.id]));
  const changes = [];
  for (const tab of Object.keys(TABS)) {
    const raw = book.getSheetByName(tab);
    const rawHeaders = raw.getRange(1, 1, 1, raw.getLastColumn()).getValues()[0].map(norm);
    const idCol = TABS[tab].length;
    if (rawHeaders[idCol - 1] && rawHeaders[idCol - 1] !== "judgeid") throw new Error("Unexpected judging storage columns. Contact an organizer.");
    for (const row of rows(book, tab).filter((r) => text(r.judge))) {
      let id = text(row.judgeid);
      if (!id) {
        id = byName.get(norm(row.judge)) || Utilities.getUuid();
        byName.set(norm(row.judge), id);
      }
      const name = byId.get(id)?.name || text(row.judge);
      if (roster.some((r) => norm(r.name) === norm(name) && r.id !== id))
        throw new Error("A judge name matches a different former judge. Use a distinct name or restore their original Judges row.");
      if (id !== text(row.judgeid)) changes.push([raw, row._row, idCol, id]);
      if (name !== text(row.judge)) changes.push([raw, row._row, rawHeaders.indexOf("judge") + 1, literal(name)]);
    }
    if (rawHeaders[idCol - 1] !== "judgeid") changes.push([raw, 1, idCol, "judgeId"]);
  }
  // Validate the complete migration before touching names or score ownership.
  while (idColumn > sheet.getMaxColumns()) sheet.insertColumnAfter(sheet.getMaxColumns());
  if (!headers.includes("judging judge id")) sheet.getRange(1, idColumn).setValue("Judging Judge ID");
  for (const judge of roster) if (!judge.existingId) sheet.getRange(judge.row, idColumn).setValue(judge.id);
  sheet.hideColumns(idColumn);
  for (const [target, row, col, value] of changes) target.getRange(row, col).setValue(value);
  props.setProperty("JUDGING_ROSTER_SIGNATURE", signature);
  return { roster, changed: true };
}
function currentJudge(book, judge) {
  const roster = unchangedJudgeRoster(book) || syncJudgeNames(book).roster;
  const current = roster.find((r) => judge.id ? r.id === judge.id : norm(r.name) === norm(judge.name));
  if (!current) throw new Error("Your judge name has been removed. Contact an organizer.");
  return { name: current.name, id: current.id };
}
function unchangedJudgeRoster(book) {
  const roster = rows(sourceBook(), "Judges").filter((r) => text(r.name)).map((r) =>
    ({ name: text(r.name), id: text(r["judging judge id"]) }));
  const signature = JSON.stringify([book.getId(), roster.map((r) => [r.id, r.name])]);
  return roster.every((r) => r.id) && PropertiesService.getScriptProperties().getProperty("JUDGING_ROSTER_SIGNATURE") === signature ? roster : null;
}
function authenticate(request) {
  const invitation = PropertiesService.getScriptProperties().getProperty("JUDGE_INVITATION");
  if (!invitation || text(request.invitation) !== invitation) throw new Error("That password isn't right.");
  const roster = unchangedJudgeRoster(privateBook());
  if (roster) {
    const matches = roster.filter((r) => norm(request.judge) && norm(r.name) === norm(request.judge));
    if (matches.length !== 1) throw new Error("Your name must match one unique Name in the Judges tab. Ask an organizer for help.");
    return matches[0];
  }
  return withLock(() => {
    const book = privateBook();
    const { roster, changed } = syncJudgeNames(book);
    if (changed) updateReports(book, readProjects());
    const name = norm(request.judge);
    const matches = roster.filter((r) => name && norm(r.name) === name);
    if (matches.length !== 1) throw new Error("Your name must match one unique Name in the Judges tab. Ask an organizer for help.");
    return { name: matches[0].name, id: matches[0].id };
  });
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
    judge = currentJudge(book, judge);
    const projects = readProjects();
    const all = sets(book);
    const mine = all.filter((s) => norm(s.judge) === norm(judge.name));
    if (mine.some((s) => !s.ranking.length) || (initial && mine.length)) return;
    const group = chooseProjects(projects, all, judge.name);
    if (!group.length) return;
    // Reserve all five review slots atomically. Legacy unclaimed sets are reusable shells.
    const next = all.find((s) => !text(s.judge));
    const id = next ? next.id : "Set " + (Math.max(0, ...all.map((s) => Number(String(s.id).replace(/^Set /, "")) || 0)) + 1);
    const row = [id, JSON.stringify(group), literal(judge.name), "", "", judge.id];
    const sheet = book.getSheetByName("Tablesets");
    if (next) sheet.getRange(next._row, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    requestReportRefresh(book, projects);
  });
}
function preassignFirstRound(showAlert = true) {
  const summary = withLock(() => {
    const book = privateBook();
    const roster = syncJudgeNames(book).roster.slice();
    const projects = syncProjects(book);
    const all = sets(book);
    let nextId = Math.max(0, ...all.map((s) => Number(String(s.id).replace(/^Set /, "")) || 0));
    const additions = [];
    let existing = 0, unavailable = 0;
    // Shuffle the roster too, so limited review slots do not always favor its first names.
    for (let i = roster.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roster[i], roster[j]] = [roster[j], roster[i]];
    }
    for (const judge of roster) {
      if (all.some((s) => norm(s.judge) === norm(judge.name))) { existing++; continue; }
      const group = chooseProjects(projects, all, judge.name);
      if (!group.length) { unavailable++; continue; }
      const id = "Set " + (++nextId);
      additions.push([id, JSON.stringify(group), literal(judge.name), "", "", judge.id]);
      all.push({ id, projects: group, judge: judge.name, ranking: [], judgeId: judge.id });
    }
    if (additions.length) {
      const sheet = book.getSheetByName("Tablesets");
      sheet.getRange(sheet.getLastRow() + 1, 1, additions.length, 6).setValues(additions);
    }
    updateReports(book, projects);
    return additions.length + " first sets assigned. " + existing + " judges already had assignments; " +
      unavailable + " had no eligible projects. Each set has up to five projects; each project allows three distinct judges.";
  });
  if (showAlert) SpreadsheetApp.getUi().alert(summary + "\nSee Review Board for assignments. Running this again will not replace existing sets.");
  return summary;
}
function setupJudgingControls() {
  const book = sourceBook();
  const sheet = book.getSheetByName("Judges");
  if (sheet.getDataRange().getValues().some((row) => row[3] === "JUDGING CONTROLS")) return;
  const start = sheet.getLastRow() + 3;
  if (sheet.getMaxRows() < start + 4) sheet.insertRowsAfter(sheet.getMaxRows(), start + 4 - sheet.getMaxRows());
  // Keep column A empty so controls are never interpreted as judge names.
  sheet.getRange(start, 4, 5, 2).setValues([
    ["JUDGING CONTROLS", ""],
    ["Preassign first round - check to run", false],
    ["Status", "Ready. Fill Expo and Judges first, then check the box above."],
    ["What it does", "Reserves up to 5 random projects per judge. Existing assignments and scores are preserved."],
    ["Capacity", "Each project can be assigned to 3 different judges. With 5 test projects, only 3 full sets are available."]
  ]);
  sheet.getRange(start + 1, 5).insertCheckboxes();
  sheet.getRange(start, 4, 1, 2).setBackground("#284f70").setFontColor("#ffffff").setFontWeight("bold");
  sheet.getRange(start + 1, 4, 1, 2).setBackground("#c6e8d3").setFontWeight("bold");
  sheet.getRange(start, 4, 5, 2).setWrap(true);
  sheet.setColumnWidth(4, 320);
  sheet.setColumnWidth(5, 650);
  const old = book.getSheetByName("Judging Controls");
  if (old) book.deleteSheet(old);
}
function reviewCoverage(projects, all, reportOnly = false) {
  const coverage = new Map(projects.map((p) => [p.id, { project: p, assigned: [], complete: [] }]));
  for (const set of all.filter((s) => text(s.judge))) {
    for (const project of set.projects) {
      const row = coverage.get(project.id);
      if (!row && reportOnly) continue;
      if (!row) throw new Error("An assigned Expo project was removed. Restore it before continuing.");
      if (row.assigned.some((review) => norm(review.judge) === norm(set.judge)))
        throw new Error("Duplicate review assignment for " + project.name + ". Contact an organizer.");
      const review = { judge: text(set.judge), set: set.id, place: set.ranking.indexOf(project.id) };
      row.assigned.push(review);
      if (review.place >= 0) row.complete.push(review);
      if (row.assigned.length > REVIEWS_PER_PROJECT) throw new Error("Too many review assignments for " + project.name);
    }
  }
  return coverage;
}
function chooseProjects(projects, all, judgeName) {
  const coverage = reviewCoverage(projects, all);
  const eligible = projects.filter((p) => {
    const row = coverage.get(p.id);
    return row.assigned.length < REVIEWS_PER_PROJECT && !row.assigned.some((r) => norm(r.judge) === norm(judgeName));
  });
  // Randomize within coverage levels, prioritizing projects with fewer reserved reviews.
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  eligible.sort((a, b) => coverage.get(a.id).assigned.length - coverage.get(b.id).assigned.length);
  return eligible.slice(0, 5);
}
function pollingProjects() {
  // Cache only display metadata. Allocation and all writes still use fresh Expo rows.
  const key = "poll-projects-v1:" + SOURCE_SPREADSHEET_ID;
  let cache;
  try {
    cache = CacheService.getScriptCache();
    const saved = cache.get(key);
    if (saved) return JSON.parse(saved);
  } catch (_) { /* Cache failures must not interrupt judging. */ }
  const projects = readProjects(false, true);
  try { if (cache) cache.put(key, JSON.stringify(projects), 15); } catch (_) {}
  return projects;
}
function snapshot(judge, all) {
  const book = privateBook();
  let projects = pollingProjects();
  all = all || sets(book);
  const cachedIds = new Set(projects.map((p) => p.id));
  if (all.some((s) => text(s.judge) && s.projects.some((p) => !cachedIds.has(p.id))) ||
      all.every((s) => !text(s.judge) || s.ranking.length)) projects = readProjects(false, true);
  const byId = new Map(projects.map((p) => [p.id, p]));
  // Overlay live Expo details without writing every assignment during polling.
  for (const set of all.filter((s) => text(s.judge))) set.projects = set.projects.map((p) => {
    if (!byId.has(p.id)) throw new Error("An assigned Expo project was removed. Ask an organizer to restore it.");
    return byId.get(p.id);
  });
  const mine = all.filter((s) => norm(s.judge) === norm(judge.name));
  const ids = new Set(mine.map((s) => s.id));
  const coverage = reviewCoverage(projects, all);
  const finished = [...coverage.values()].every((r) => r.complete.length === REVIEWS_PER_PROJECT);
  const eligible = [...coverage.values()].some((r) => r.assigned.length < REVIEWS_PER_PROJECT && !r.assigned.some((a) => norm(a.judge) === norm(judge.name)));
  // Explicit allowlist: no other judges, overall results, or top-five markers leave the server.
  return { version: VERSION, judge: { name: judge.name }, assignmentMessage: finished ? "Every project has three completed reviews. Thank you!" :
    eligible ? "You can request another random tableset of projects you have not reviewed." :
    "No projects are available for you right now. Remaining reviews need other judges or are already assigned.",
    tablesets: mine.map((s) => ({ id: s.id, projects: s.projects,
    ranking: s.ranking, complete: !!s.ranking.length })),
    scores: rows(book, "Scores").filter((r) => norm(r.judge) === norm(judge.name) && ids.has(r.tableset))
      .map((r) => ({ id: r.id, tableset: r.tableset, project: r.project,
        scores: Object.fromEntries(Object.keys(CRITERIA).map((key) => [key, Number(r[key])])),
        total: Number(r.total), notes: text(r.notes) })) };
}
// Stable IDs allow names/tables to change without moving a judge's saved scores.
// Refresh assigned project details without changing membership or stable score IDs.
function syncProjects(book, projects = readProjects(), reportOnly = false) {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const all = sets(book);
  const original = new Map(all.map((set) => [set.id, JSON.stringify(set.projects)]));
  for (const set of all.filter((s) => text(s.judge))) {
    set.projects = set.projects.map((p) => {
      const current = byId.get(p.id);
      // Preserve withdrawn projects in the audit trail, not in organizer reports.
      if (!current && reportOnly) return p;
      if (!current) throw new Error("An assigned Expo project was removed. Ask an organizer to restore it.");
      return current;
    });
  }
  const sheet = book.getSheetByName("Tablesets");
  for (const set of all) {
    const serialized = JSON.stringify(set.projects);
    if (serialized !== original.get(set.id)) sheet.getRange(set._row, 2).setValue(serialized);
  }
  return projects;
}
function doPost(e) {
  let result;
  requestBooks = {};
  try {
    const request = JSON.parse(e.postData.contents);
    requestBooks.retryBusy = request.retryBusy === true;
    if (![VERSION, "tablesets-v1"].includes(request.version)) throw new Error("Judging has changed. Refresh this page before continuing.");
    const judge = authenticate(request);
    if (request.action === "login") result = { version: VERSION, judge: { name: judge.name } };
    else if (request.action === "config") {
      // Already-preassigned judges only read. claim() still locks/rechecks new work.
      const all = sets(privateBook());
      if (all.some((s) => norm(s.judge) === norm(judge.name))) result = snapshot(judge, all);
      else { claim(judge, true); result = snapshot(judge); }
    }
    else if (request.action === "claim") { claim(judge, false); result = snapshot(judge); }
    else if (request.action === "submit") result = { entry: submit(judge, request.entry) };
    else if (request.action === "complete") {
      complete(judge, request.tableset, request.ranking);
      // Updated clients acknowledge the durable write before loading reports/assignments.
      result = request.completionAck === true
        ? { version: VERSION, completedTableset: request.tableset }
        : snapshot(judge);
    }
    else throw new Error("Unknown action.");
    // The prior tableset UI uses the same request/response contract during rollout.
    if (result.version) result.version = request.version;
    result.ok = true;
  } catch (error) { result = { ok: false, error: error.message, retryable: error.retryable === true }; }
  finally { requestBooks = null; }
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
    judge = currentJudge(book, judge);
    const set = ownedSet(book, judge, entry.tableset);
    if (set.ranking.length) throw new Error("This tableset is complete; scores are locked.");
    if (!set.projects.some((p) => p.id === entry.project)) throw new Error("Project is not in your tableset.");
    const { scores, total } = validateScores(entry.scores);
    const id = JSON.stringify([set.id, entry.project]);
    const row = [id, judge.name, set.id, entry.project, ...Object.keys(CRITERIA).map((k) => scores[k]),
      total, text(entry.notes).slice(0, 5000), new Date(), judge.id];
    const existing = rows(book, "Scores").find((r) => r.id === id);
    const sheet = book.getSheetByName("Scores");
    sheet.getRange(existing ? existing._row : sheet.getLastRow() + 1, 1, 1, row.length).setValues([row.map(literal)]);
    requestReportRefresh(book);
    return { id, tableset: set.id, project: entry.project, scores, total, notes: row[10] };
  });
}
function complete(judge, id, ranking) {
  return withLock(() => {
    const book = privateBook();
    judge = currentJudge(book, judge);
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
    const totals = new Map(scores.map((score) => [score.project, Number(score.total)]));
    if (ranking.some((project, i) => i > 0 && totals.get(project) > totals.get(ranking[i - 1])))
      throw new Error("Scores changed. Refresh and review the automatic ranking before finishing.");
    // One range write commits the whole ranking, avoiding partial point awards.
    book.getSheetByName("Tablesets").getRange(set._row, 4, 1, 2).setValues([[JSON.stringify(ranking), new Date()]]);
    requestReportRefresh(book);
  });
}
function requestReportRefresh(book, projects) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("JUDGING_DEFER_REPORTS") === "true")
    props.setProperty("JUDGING_REPORTS_DIRTY", "true");
  else updateReports(book, projects || readProjects());
}
function enableDeferredJudgingReports() {
  const handler = "flushJudgingReports";
  if (!ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === handler))
    ScriptApp.newTrigger(handler).timeBased().everyMinutes(1).create();
  // Enable only after the background worker exists. No judging data is reset.
  const props = PropertiesService.getScriptProperties();
  props.setProperty("JUDGING_REPORTS_DIRTY", "true");
  props.setProperty("JUDGING_DEFER_REPORTS", "true");
}
function reduceJudgingReportFrequency() {
  // Keep durable score writes immediate; only organizer summaries lag behind.
  const handler = "flushJudgingReports";
  const previous = ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === handler);
  ScriptApp.newTrigger(handler).timeBased().everyMinutes(5).create();
  previous.forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  PropertiesService.getScriptProperties().setProperty("JUDGING_DEFER_REPORTS", "true");
}
function flushJudgingReports() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("JUDGING_REPORTS_DIRTY") !== "true") return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // Leave dirty; the next scheduled run retries.
  requestBooks = {};
  try {
    const book = privateBook();
    updateReports(book, syncProjects(book, readProjects(true), true));
    SpreadsheetApp.flush();
    // Keep the marker on failure, and clear it under the same lock as score writes.
    props.deleteProperty("JUDGING_REPORTS_DIRTY");
  } finally {
    requestBooks = null;
    lock.releaseLock();
  }
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
    "\nKeep access restricted to organizers only. Do not publish it. Now run Prepare three-review judging.");
}
function buildTablesets() {
  withLock(() => {
    const book = privateBook();
    const projects = syncProjects(book);
    updateReports(book, projects);
    formatReviewReports(book);
    sourceBook().toast(projects.length + " projects need " + projects.length * REVIEWS_PER_PROJECT +
      " reviews by distinct judges. Existing assignments and scores were preserved. New sets are randomized when claimed.");
  });
}
function consolidateOrganizerWorkbook() {
  withLock(() => {
    const destination = sourceBook();
    if (DriveApp.getFileById(destination.getId()).getSharingAccess() !== DriveApp.Access.PRIVATE)
      throw new Error("Set the source spreadsheet sharing to Restricted before consolidating private scores.");
    const props = PropertiesService.getScriptProperties();
    const previousId = props.getProperty("JUDGING_PRIVATE_SHEET_ID");
    if (previousId !== destination.getId()) {
      const previous = privateBook();
      for (const name of ["Results", "Review Board", "Judge Notes"]) {
        if (destination.getSheetByName(name)) throw new Error("Destination already has " + name + ". No data was overwritten; contact the organizer.");
      }
      // The same script lock protects live submissions throughout the copy and switch.
      for (const name of Object.keys(TABS)) {
        const original = previous.getSheetByName(name);
        const copied = destination.getSheetByName(name) || original.copyTo(destination).setName(name);
        const values = original.getDataRange().getValues();
        const comparable = (data, dates) => JSON.stringify(data.map((row) => row.map((value) =>
          Object.prototype.toString.call(value) === "[object Date]" ? (dates ? Math.round(value.getTime() / 1000) : "<timestamp>") : value)));
        if (comparable(values, false) !== comparable(copied.getDataRange().getValues(), false))
          throw new Error("Copy verification failed for " + name + ". The original workbook is still live.");
        // Native copies preserve date serials, not instants, across different workbook time zones.
        values.forEach((row, i) => row.forEach((value, j) => {
          if (Object.prototype.toString.call(value) === "[object Date]") copied.getRange(i + 1, j + 1).setValue(value);
        }));
        SpreadsheetApp.flush();
        if (comparable(values, true) !== comparable(copied.getDataRange().getValues(), true))
          throw new Error("Timestamp verification failed for " + name + ". The original workbook is still live.");
      }
      props.setProperty("JUDGING_BACKUP_SHEET_ID", previousId);
      props.setProperty("JUDGING_PRIVATE_SHEET_ID", destination.getId());
    }
    updateReports(destination, syncProjects(destination));
    formatReviewReports(destination);
    destination.toast("This workbook now holds live assignments, scores, judge notes and results. The old scoring workbook is a backup only.");
  });
}
function resultRows(all, scores, projects) {
  const coverage = reviewCoverage(projects, all, true);
  const results = [...coverage.values()].map((r) => ({ ...r.project,
    count: r.complete.length,
    reviewed: r.complete.map((review) => review.judge).join(", "),
    pending: r.assigned.filter((review) => review.place < 0).map((review) => review.judge).join(", "),
    points: r.complete.reduce((sum, review) => sum + POINTS[review.place], 0),
    total: r.complete.reduce((sum, review) => sum + Number(scores.find((s) =>
      s.tableset === review.set && s.project === r.project.id && norm(s.judge) === norm(review.judge))?.total || 0), 0),
  })).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  // Equal points stay tied. Rubric totals do NOT break ties; name only stabilizes display.
  let rank = 0;
  return results.map((r, i) => {
    if (!i || r.points !== results[i - 1].points) rank = i + 1;
    return [rank, r.name, r.table, r.count, r.points, Math.round(r.total * 100) / 100,
      r.count === REVIEWS_PER_PROJECT ? "Completed" : "Pending", r.reviewed, r.pending];
  });
}
function pendingJudges(item) {
  const pending = item.assigned.filter((r) => r.place < 0).map((r) => r.judge);
  const unassigned = REVIEWS_PER_PROJECT - item.assigned.length;
  if (unassigned) pending.push(unassigned + " not yet assigned");
  return pending.join("; ") || "All 3 reviews finished";
}
function updateReports(book, projects) {
  syncJudgeNames(book);
  const all = sets(book);
  const coverage = reviewCoverage(projects, all, true);
  const results = book.getSheetByName("Results");
  const resultHeaders = results ? results.getRange(1, 1, 1, results.getLastColumn()).getValues()[0].map(norm) : [];
  resultHeaders.map((header, i) => [header, i + 1]).reverse().forEach(([header, column]) => {
    if (["reviews required", "top 5 status", "top 5 (organizers only)"].includes(header)) results.deleteColumn(column);
  });
  if (results && resultHeaders.length && !resultHeaders.includes("table")) results.insertColumnBefore(3);
  writeTab(book, "Results", ["Rank (ties shared)", "Project", "Table", "Reviews complete", "Points /45",
    "Rubric total /144", "Status", "Reviewed by", "In progress"],
    resultRows(all, rows(book, "Scores"), projects));
  formatResults(book);
  updateOrganizerViews(book, projects);
  const sheet = sourceBook().getSheetByName("Expo");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(norm);
  const sourceRows = rows(sourceBook(), "Expo");
  const tableCounts = new Map();
  for (const p of projects) tableCounts.set(norm(p.table), (tableCounts.get(norm(p.table)) || 0) + 1);
  const progress = sourceRows.map((row) => {
    const item = coverage.get(text(row["judging id"]));
    if (!item) return PROGRESS_HEADERS.map(() => "");
    return [item.complete.length, item.complete.map((r) => r.judge).join(", "),
      item.assigned.filter((r) => r.place < 0).map((r) => r.judge).join(", "),
      REVIEWS_PER_PROJECT - item.complete.length, tableCounts.get(norm(item.project.table)) > 1 ? "DUPLICATE TABLE" : "OK",
      REVIEWS_PER_PROJECT - item.complete.length];
  });
  // Append only our generated columns. Never overwrite the original judge columns or totals.
  PROGRESS_HEADERS.forEach((name, index) => {
    let column = headers.indexOf(norm(name)) + 1;
    if (!column) {
      column = headers.length + 1;
      while (column > sheet.getMaxColumns()) sheet.insertColumnAfter(sheet.getMaxColumns());
      sheet.getRange(1, column).setValue(name);
      headers.push(norm(name));
    }
    if (sheet.getLastRow() < 2) return;
    const values = Array.from({ length: sheet.getLastRow() - 1 }, () => [""]);
    sourceRows.forEach((row, i) => { values[row._row - 2] = [literal(progress[i][index])]; });
    const range = sheet.getRange(2, column, values.length, 1);
    if (JSON.stringify(range.getValues()) !== JSON.stringify(values)) range.setValues(values);
  });
  const props = PropertiesService.getScriptProperties();
  props.setProperty("JUDGING_REPORTED_ROSTER", props.getProperty("JUDGING_ROSTER_SIGNATURE"));
  props.setProperty("JUDGING_REPORTED_PROJECTS", projectSignature(projects));
}
function updateOrganizerViews(book, projects) {
  const all = sets(book);
  const coverage = reviewCoverage(projects, all, true);
  const scores = rows(book, "Scores");
  // Keep former roster members visible when they have already reviewed a project.
  const judges = new Map();
  for (const name of [...rows(sourceBook(), "Judges").map((r) => text(r.name)), ...all.map((s) => text(s.judge))]) {
    if (name && !judges.has(norm(name))) judges.set(norm(name), name);
  }
  const names = [...judges.values()];
  const board = book.getSheetByName("Review Board");
  const layoutChanged = !board || board.getLastColumn() !== names.length + 4 || !book.getSheetByName("Judge Notes");
  const data = projects.map((project) => {
    const item = coverage.get(project.id);
    const points = names.map((name) => {
      const review = item.complete.find((r) => norm(r.judge) === norm(name));
      return review ? POINTS[review.place] : "";
    });
    return [project.table, project.name, pendingJudges(item), ...points,
      item.complete.length ? points.reduce((sum, value) => sum + Number(value), 0) : ""];
  });
  writeTab(book, "Review Board", ["Table", "Project", "Judges pending", ...names, "Total points /45"], data);
  const currentBoard = book.getSheetByName("Review Board");
  if (currentBoard.getMaxColumns() > names.length + 4)
    currentBoard.deleteColumns(names.length + 5, currentBoard.getMaxColumns() - names.length - 4);
  colorJudgePoints(currentBoard, names.length);
  const notes = projects.flatMap((project) => scores.filter((s) => s.project === project.id && text(s.notes)).map((score) => {
    const review = coverage.get(project.id).assigned.find((r) => r.set === score.tableset && norm(r.judge) === norm(score.judge));
    return [project.table, project.name, text(score.judge), text(score.notes), Number(score.total),
      review && review.place >= 0 ? "Finished" : "Saved - review in progress"];
  }));
  writeTab(book, "Judge Notes", ["Table", "Project", "Judge", "Judge notes", "Rubric /48", "Review status"], notes);
  if (layoutChanged) formatOrganizerViews(book);
  else {
    book.getSheetByName("Judge Notes").getRange(2, 1, Math.max(1, notes.length), 6).setWrap(true);
    board.getRange(2, 1, Math.max(1, data.length), names.length + 4).setWrap(true);
  }
}
function colorJudgePoints(sheet, judgeCount) {
  if (!judgeCount) return;
  const palette = [[15, "#c6e8d3", "#174b32"], [10, "#fce8b2", "#624600"],
    [5, "#cfe2f3", "#1c4263"], [0, "#e7e9ed", "#464c56"]];
  const formulas = palette.map(([points]) => '=AND(ISNUMBER(D2),D2=' + points + ',N("judging-points")=0)');
  const allRules = sheet.getConditionalFormatRules();
  const managed = allRules.filter((rule) => rule.getBooleanCondition()?.getCriteriaValues().some((v) => String(v).includes('N("judging-points")')));
  if (managed.length === 4 && managed.every((rule, i) => rule.getBooleanCondition().getCriteriaValues()[0] === formulas[i] &&
    rule.getRanges()[0].getNumColumns() === judgeCount && rule.getRanges()[0].getNumRows() === sheet.getMaxRows() - 1)) return;
  const existing = allRules.filter((rule) => !managed.includes(rule));
  const range = sheet.getRange(2, 4, sheet.getMaxRows() - 1, judgeCount);
  const rules = palette.map(([, background, foreground], i) => SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(formulas[i]).setBackground(background).setFontColor(foreground).setBold(true).setRanges([range]).build());
  // Clear old manual fills only in judge-point cells; blanks must stay uncolored.
  range.setBackground(null).setFontColor(null).setFontWeight("normal");
  sheet.setConditionalFormatRules([...rules, ...existing]);
}
function refreshJudgeNamesOnEdit(e) {
  if (!e || e.source.getId() !== SOURCE_SPREADSHEET_ID) return;
  const tab = e.range.getSheet().getName();
  if (tab === "Judges" && e.value === "TRUE" && e.range.getColumn() === 5 &&
      e.range.getSheet().getRange(e.range.getRow(), 4).getValues()[0][0] === "Preassign first round - check to run") {
    const sheet = e.range.getSheet();
    const status = sheet.getRange(e.range.getRow() + 1, 5);
    status.setValue("Assigning projects. Please wait...");
    try { status.setValue(preassignFirstRound(false)); }
    catch (error) { status.setValue("Could not assign: " + error.message); }
    finally { e.range.setValue(false); }
    return;
  }
  if (tab === "Judges") refreshChangedJudgeRoster();
  if (tab === "Expo") refreshChangedExpo();
}
function projectSignature(projects) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(projects)));
}
function refreshChangedExpo() {
  try { CacheService.getScriptCache().remove("poll-projects-v1:" + SOURCE_SPREADSHEET_ID); } catch (_) {}
  withLock(() => {
    const book = privateBook();
    const projects = readProjects(true);
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty("JUDGING_REPORTED_PROJECTS") !== projectSignature(projects))
      updateReports(book, syncProjects(book, projects, true));
  });
}
function refreshJudgingStructure(e) {
  if (!e || e.source.getId() !== SOURCE_SPREADSHEET_ID || !["INSERT_ROW", "REMOVE_ROW", "OTHER"].includes(e.changeType)) return;
  refreshChangedJudgeRoster();
  refreshChangedExpo();
}
function refreshChangedJudgeRoster() {
  withLock(() => {
    const book = privateBook();
    // Queued edits read the latest roster once; already-applied edits need no report rebuild.
    const changed = syncJudgeNames(book).changed;
    const props = PropertiesService.getScriptProperties();
    if (changed || props.getProperty("JUDGING_REPORTED_ROSTER") !== props.getProperty("JUDGING_ROSTER_SIGNATURE"))
      updateReports(book, syncProjects(book, readProjects(true), true));
  });
}
function enableLiveJudgeUpdates() {
  computeResults();
  setupJudgingControls();
  const triggers = ScriptApp.getProjectTriggers();
  for (const [handler, event, method] of [["refreshJudgeNamesOnEdit", ScriptApp.EventType.ON_EDIT, "onEdit"],
    ["refreshJudgingStructure", ScriptApp.EventType.ON_CHANGE, "onChange"]]) {
    if (!triggers.some((t) => t.getHandlerFunction() === handler && t.getTriggerSourceId() === SOURCE_SPREADSHEET_ID && t.getEventType() === event))
      ScriptApp.newTrigger(handler).forSpreadsheet(SOURCE_SPREADSHEET_ID)[method]().create();
  }
  sourceBook().toast("Judge names now sync automatically. Points: green 15, yellow 10, blue 5, gray 0; blank means not finished.");
}
function formatOrganizerViews(book) {
  for (const name of ["Review Board", "Judge Notes"]) {
    const sheet = book.getSheetByName(name);
    const columns = sheet.getLastColumn();
    sheet.getRange(1, 1, 1, columns).setBackground("#284f70").setFontColor("#ffffff").setFontWeight("bold").setWrap(true);
    sheet.setFrozenColumns(2);
    sheet.setColumnWidth(1, 65);
    sheet.setColumnWidth(2, 280);
    sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), columns).setWrap(true);
    sheet.setColumnWidths(3, columns - 2, 120);
    if (name === "Review Board") {
      sheet.setColumnWidth(3, 250);
      sheet.getRange(1, 3).setNote("Assigned judges still working, plus review slots not yet assigned. Each project needs three different judges.");
      if (columns > 4) sheet.getRange(1, 4, 1, columns - 4).setNote("Points awarded after finishing a tableset: 15, 10, 5, 0, 0. Blank means no completed review; 0 means reviewed with zero points.");
      sheet.getRange(1, columns).setNote("Sum of finished reviews only; provisional until all three reviews finish. No completed reviews is blank, not zero.");
      sheet.getRange(2, 4, Math.max(1, sheet.getLastRow() - 1), columns - 3).setNumberFormat("0");
      sheet.getRange(2, columns, Math.max(1, sheet.getLastRow() - 1), 1).setFontWeight("bold").setBackground("#e8f1f7");
    } else {
      sheet.setColumnWidth(4, 440);
      sheet.setColumnWidth(6, 210);
    }
  }
}
function formatReviewReports(book) {
  formatOrganizerViews(book);
  formatResults(book);
  const sheet = sourceBook().getSheetByName("Expo");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(norm);
  for (const name of PROGRESS_HEADERS) {
    const col = headers.indexOf(norm(name)) + 1;
    sheet.getRange(1, col).setBackground("#284f70").setFontColor("#ffffff").setFontWeight("bold").setWrap(true);
    sheet.setColumnWidth(col, /by|progress/.test(name) ? 250 : 160);
    sheet.getRange(2, col, Math.max(1, sheet.getLastRow() - 1), 1).setWrap(true);
  }
}
function formatResults(book) {
  const results = book.getSheetByName("Results");
  results.getRange(1, 1, 1, 9).setBackground("#284f70").setFontColor("#ffffff").setFontWeight("bold").setWrap(true);
  results.setFrozenColumns(2);
  results.setColumnWidth(1, 110);
  results.setColumnWidth(2, 300);
  results.setColumnWidths(3, 4, 120);
  results.setColumnWidth(7, 140);
  results.setColumnWidths(8, 2, 270);
  results.getRange(2, 1, Math.max(1, results.getLastRow() - 1), 9).setWrap(true);
  results.getRange(1, 4).setNote("Each project needs three completed reviews from different judges.");
  const specs = [
    [7, '=AND(G2="Pending",N("judging-status")=0)', "#fff2cc", "#66501b"],
    [7, '=AND(G2="Completed",N("judging-status")=0)', "#c6e8d3", "#174b32"],
  ];
  const previous = results.getConditionalFormatRules();
  if (previous.filter((rule) => rule.getBooleanCondition()?.getCriteriaValues().some((v) => String(v).includes('N("judging-status")'))).length === specs.length) return;
  const other = previous.filter((rule) => !rule.getBooleanCondition()?.getCriteriaValues().some((v) => String(v).includes('N("judging-status")')));
  const rules = specs.map(([col, formula, background, foreground]) => SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(formula).setBackground(background).setFontColor(foreground).setBold(true)
    .setRanges([results.getRange(2, col, results.getMaxRows() - 1, 1)]).build());
  results.setConditionalFormatRules([...rules, ...other]);
}
function computeResults() {
  withLock(() => {
    const book = privateBook();
    updateReports(book, syncProjects(book, readProjects(true), true));
    sourceBook().toast("Review progress and private results updated. Equal points stay tied for organizers to resolve.");
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
    if (sets(privateBook()).some((s) => text(s.judge))) throw new Error("Import before judging starts. Existing sets are preserved.");
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
