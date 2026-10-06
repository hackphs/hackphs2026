/**
 * hackPHS 2026 judging backend (Google Apps Script, bound to a Google Sheet).
 *
 * Setup:
 *   1. Create a Google Sheet, open Extensions > Apps Script, and paste this file in as Code.gs.
 *   2. Project Settings > Script properties: add JUDGE_CODE (the code judges sign in with).
 *      Optionally add SAMPLE_PROJECT (defaults to "Sample project (hackPHS 2025)").
 *   3. Reload the sheet and run hackPHS Judging > Set up sheets.
 *   4. Fill in the Judges tab (name, role = judge or exec) and the Projects tab
 *      (name, table, tracks as a comma-separated list).
 *   5. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *      Copy the URL into ENDPOINT at the top of judging/judging.js.
 *
 * Judging day (all from the hackPHS Judging menu):
 *   - Assign projects: gives every judge an even share, with each project getting >= 2 judges.
 *   - Compute round 1: applies the calibration weights, ranks all projects, writes the top 10 to Finalists.
 *   - Compute finals & tracks: averages the executive panel's finals scores and each track's scores.
 */

const JUDGES_PER_PROJECT = 2;
const FINALIST_COUNT = 10;
const WINNER_COUNT = 3;
const MAX_TOTAL = 48;
const CRITERIA = { innovation: 0.25, functionality: 0.3, creativity: 0.25, theme: 0.1, technical: 0.1 };
const ROUNDS = ["calibration", "round1", "finals", "tracks"];

const TABS = {
  Judges: ["name", "role"],
  Projects: ["name", "table", "tracks"],
  Assignments: ["judge", "project"],
  Finalists: ["project"],
  Scores: ["id", "judge", "round", "track", "project", ...Object.keys(CRITERIA), "total", "notes", "updatedAt"],
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("hackPHS Judging")
    .addItem("Set up sheets", "setup")
    .addItem("Assign projects", "assignProjects")
    .addItem("Compute round 1", "computeRound1")
    .addItem("Compute finals & tracks", "computeFinals")
    .addToUi();
}

/* ---------- Web app ---------- */

function doPost(e) {
  let out;
  try {
    const request = JSON.parse(e.postData.contents);
    const judge = authenticate(request);
    if (request.action === "config") {
      out = { judge, config: configFor(judge), scores: scoresFor(judge) };
    } else if (request.action === "submit") {
      out = { entry: submit(judge, request.entry) };
    } else {
      throw new Error("Unknown action.");
    }
    out.ok = true;
  } catch (error) {
    out = { ok: false, error: error.message };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function authenticate(request) {
  const code = PropertiesService.getScriptProperties().getProperty("JUDGE_CODE");
  if (!code || String(request.code || "").trim() !== code) {
    throw new Error("That judging code isn't right.");
  }
  const judge = readRows("Judges").find((row) => norm(row.name) === norm(request.judge));
  if (!judge) {
    throw new Error("We don't have you on the judge list. Check the spelling of your name or ask an organizer.");
  }
  return { name: String(judge.name).trim(), role: norm(judge.role) === "exec" ? "exec" : "judge" };
}

function configFor(judge) {
  const projects = readRows("Projects").map((row) => ({
    name: String(row.name).trim(),
    table: String(row.table || "").trim(),
    tracks: String(row.tracks || "").split(",").map((t) => t.trim()).filter(Boolean),
  }));
  return {
    sampleProject: sampleProject(),
    projects,
    assignments: readRows("Assignments")
      .filter((row) => norm(row.judge) === norm(judge.name))
      .map((row) => String(row.project).trim()),
    finalists: readRows("Finalists").map((row) => String(row.project).trim()),
  };
}

function scoresFor(judge) {
  return readRows("Scores")
    .filter((row) => norm(row.judge) === norm(judge.name))
    .map((row) => ({
      id: row.id,
      judge: row.judge,
      round: row.round,
      track: String(row.track || ""),
      project: String(row.project),
      scores: Object.fromEntries(Object.keys(CRITERIA).map((key) => [key, Number(row[key])])),
      total: Number(row.total),
      notes: String(row.notes || ""),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    }));
}

function submit(judge, entry) {
  if (!entry || !ROUNDS.includes(entry.round)) {
    throw new Error("Unknown judging round.");
  }
  if (entry.round === "finals" && judge.role !== "exec") {
    throw new Error("Only the executive panel scores finals.");
  }
  const project = String(entry.project || "").trim();
  const track = entry.round === "tracks" ? String(entry.track || "").trim() : "";
  if (!project || (entry.round === "tracks" && !track)) {
    throw new Error("Missing project or track.");
  }

  let total = 0;
  const scores = {};
  for (const [key, weight] of Object.entries(CRITERIA)) {
    const score = Number(entry.scores && entry.scores[key]);
    if (!Number.isInteger(score) || score < 1 || score > 12) {
      throw new Error(`Score for ${key} must be 1 to 12.`);
    }
    scores[key] = score;
    total += weight * score;
  }
  total = Math.round(total * (MAX_TOTAL / 12) * 100) / 100;

  const id = [judge.name, entry.round, track, project].map(norm).join("|");
  const row = [id, judge.name, entry.round, track, project, ...Object.keys(CRITERIA).map((k) => scores[k]), total,
    String(entry.notes || ""), new Date()];

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = tab("Scores");
    const ids = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat() : [];
    const index = ids.indexOf(id);
    if (index === -1) {
      sheet.appendRow(row);
    } else {
      sheet.getRange(index + 2, 1, 1, row.length).setValues([row]);
    }
  } finally {
    lock.releaseLock();
  }
  return { id, total };
}

/* ---------- Organizer menu actions ---------- */

function setup() {
  for (const [name, headers] of Object.entries(TABS)) {
    const sheet = tab(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
    }
  }
  toast("Sheets are ready. Fill in Judges and Projects.");
}

function assignProjects() {
  const judges = readRows("Judges").map((row) => String(row.name).trim()).filter(Boolean);
  const projects = readRows("Projects").map((row) => String(row.name).trim()).filter(Boolean);
  if (judges.length < JUDGES_PER_PROJECT) {
    throw new Error(`Need at least ${JUDGES_PER_PROJECT} judges.`);
  }
  if (readRows("Assignments").length && !confirm("Replace the existing assignments?")) {
    return;
  }

  // Greedy: each slot goes to the least-loaded judge not already on that project (random tie-break),
  // which keeps everyone within one project of each other.
  const load = Object.fromEntries(judges.map((judge) => [judge, 0]));
  const rows = [];
  for (const project of shuffle(projects)) {
    const picked = [];
    for (let slot = 0; slot < JUDGES_PER_PROJECT; slot++) {
      const candidates = shuffle(judges.filter((judge) => !picked.includes(judge)));
      candidates.sort((a, b) => load[a] - load[b]);
      const judge = candidates[0];
      picked.push(judge);
      load[judge]++;
      rows.push([judge, project]);
    }
  }
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  writeTab("Assignments", TABS.Assignments, rows);
  toast(`Assigned ${projects.length} projects across ${judges.length} judges.`);
}

function computeRound1() {
  const scores = readRows("Scores");

  // Calibration: a judge's weight is (average sample score across judges) / (their sample score),
  // so a harsh judge gets a weight above 1 and a generous one below 1. No calibration score = weight 1.
  const calibration = scores.filter((row) => row.round === "calibration");
  const meanSample = average(calibration.map((row) => Number(row.total)));
  const weights = {};
  for (const row of calibration) {
    weights[norm(row.judge)] = meanSample / Number(row.total);
  }

  const byProject = groupBy(scores.filter((row) => row.round === "round1"), (row) => norm(row.project));
  const results = Object.values(byProject).map((rows) => {
    const raw = average(rows.map((row) => Number(row.total)));
    const compensation = average(rows.map((row) => weights[norm(row.judge)] || 1));
    return {
      project: String(rows[0].project).trim(),
      judges: rows.map((row) => row.judge).join(", "),
      count: rows.length,
      raw,
      compensation,
      adjusted: raw * compensation,
    };
  });
  results.sort((a, b) => b.adjusted - a.adjusted);

  // Top 10, but if 10th and 11th tie, drop back to the top 9 (and so on).
  let cutoff = Math.min(FINALIST_COUNT, results.length);
  while (cutoff > 0 && cutoff < results.length && same(results[cutoff - 1].adjusted, results[cutoff].adjusted)) {
    cutoff--;
  }

  writeTab(
    "Round 1 Results",
    ["rank", "project", "adjusted /48", "raw avg /48", "compensation", "# judges", "judges", "finalist"],
    results.map((r, i) => [i + 1, r.project, round2(r.adjusted), round2(r.raw), round2(r.compensation), r.count, r.judges,
      i < cutoff ? "yes" : ""])
  );
  writeTab(
    "Calibration Weights",
    ["judge", "sample score /48", "weight"],
    calibration.map((row) => [row.judge, Number(row.total), round2(weights[norm(row.judge)])])
  );
  writeTab("Finalists", TABS.Finalists, results.slice(0, cutoff).map((r) => [r.project]));

  const thin = results.filter((r) => r.count < JUDGES_PER_PROJECT).length;
  toast(`${cutoff} finalists selected.` + (thin ? ` ${thin} project(s) have fewer than ${JUDGES_PER_PROJECT} scores.` : ""));
}

function computeFinals() {
  const scores = readRows("Scores");

  const finals = Object.values(groupBy(scores.filter((row) => row.round === "finals"), (row) => norm(row.project)))
    .map((rows) => ({ project: String(rows[0].project).trim(), avg: average(rows.map((row) => Number(row.total))), count: rows.length }))
    .sort((a, b) => b.avg - a.avg);

  const tracks = Object.values(groupBy(scores.filter((row) => row.round === "tracks"),
    (row) => norm(row.track) + "|" + norm(row.project)))
    .map((rows) => ({
      track: String(rows[0].track).trim(),
      project: String(rows[0].project).trim(),
      avg: average(rows.map((row) => Number(row.total))),
      count: rows.length,
    }))
    .sort((a, b) => a.track.localeCompare(b.track) || b.avg - a.avg);

  writeTab(
    "Finals Results",
    ["rank", "project", "avg /48", "# exec votes", "winner"],
    finals.map((r, i) => [i + 1, r.project, round2(r.avg), r.count, i < WINNER_COUNT ? `#${i + 1}` : ""])
  );
  writeTab("Track Results", ["track", "project", "avg /48", "# judges"], tracks.map((r) => [r.track, r.project, round2(r.avg), r.count]));
  toast("Finals and track results updated.");
}

/* ---------- Helpers ---------- */

function sampleProject() {
  return PropertiesService.getScriptProperties().getProperty("SAMPLE_PROJECT") || "Sample project (hackPHS 2025)";
}

function tab(name) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  return book.getSheetByName(name) || book.insertSheet(name);
}

function readRows(name) {
  const values = tab(name).getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }
  const headers = values[0].map((h) => String(h).trim());
  return values
    .slice(1)
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]])));
}

function writeTab(name, headers, rows) {
  const sheet = tab(name);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
}

function groupBy(items, keyOf) {
  const groups = {};
  for (const item of items) {
    (groups[keyOf(item)] = groups[keyOf(item)] || []).push(item);
  }
  return groups;
}

function shuffle(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function average(values) {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

function same(a, b) {
  return Math.abs(a - b) < 1e-9;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

function confirm(message) {
  const ui = SpreadsheetApp.getUi();
  return ui.alert(message, ui.ButtonSet.YES_NO) === ui.Button.YES;
}

function toast(message) {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, "hackPHS Judging", 8);
}
