# Tableset judging

## Deploy before using the updated website

1. Open the source spreadsheet as a trusted organizer. Extensions > Apps Script: replace the backend with `apps-script.gs`.
2. Run `setup` and authorize access. The source ID is configured in the backend. This creates a separate **restricted** scoring workbook, stores its ID in `JUDGING_PRIVATE_SHEET_ID`, and sets `JUDGE_INVITATION` to `Invitation` (case-sensitive).
3. Keep the private workbook accessible only to organizers. Never publish it or share it with judges/participants. Hidden tabs are not a security boundary. Source sharing is unchanged; Restricted is recommended, although the backend does not require it for the source.
4. Check `Judges` has unique names in `Name`. Check `Expo` has `Project Name` and `Table #` (also accepts `Project Table`). Optional columns: `Project Link`, `Track`. Remove sample projects before going live. Duplicate names or missing table values are errors.
5. Run `buildTablesets`. It adds a persistent `Judging ID` column to Expo; do not edit these IDs. Whole-row sorting is safe. Initial sets follow table order in groups of five. A final remainder has fewer projects and uses the corresponding ranking points; no projects are discarded.
6. Deploy > Manage deployments > Edit > New version. Execute as the organizer and allow Anyone to reach the web app. Application-level authentication requires BOTH a roster name and the invitation on every request. If creating a new deployment, update `ENDPOINT` in `judging.js`.
7. Results refresh automatically when a tableset is completed. You can also run `computeResults` from the organizer menu. Results are written only to the private workbook, never returned by the web app. Delete/disable any old deployment still running calibration/finals code after backing up old data.

The source spreadsheet URL and ID are not in frontend JS/HTML. The local server blocks `.gs` files; `_config.yml` excludes the backend from GitHub Pages/Jekyll output. If using a different hosting pipeline, explicitly exclude `.gs`, organizer documentation, and private artifacts from the deployed directory. A private repository alone does not prevent a web server from serving files copied into its public directory.

## Judge flow and live edits

- Sign in with a name matching `Judges!Name` (case and extra whitespace ignored), plus `Invitation`. No public judge-name dropdown. Credentials are kept in memory only. Names are checked server-side on every request.
- The first sign-in atomically claims an unassigned tableset. One judge can have only one unfinished set; completed sets cannot be claimed again. Extra sets are available only after all current scores and the ranking are submitted. There is no automatic timeout/reassignment that could take work away from a judge.
- Save a 1-12 score for all five unchanged rubric criteria. Weighted totals remain out of 48 for reference, not overall ranking. Unsaved drafts stay on the device; successful saves require server confirmation. Drafts do not count as completed scores.
- Rank all projects exactly once. The server awards 15, 10, 5, 0, 0 and locks the set. Repeating the identical completion request is safe; changing it afterward is rejected.
- Roster validation is live. Project names/table numbers refresh every 30 seconds and on focus, preserving drafts and ranking choices. Stable IDs retain scores across name/table edits. New projects enter unclaimed sets; assigned sets never change membership. Do not delete assigned Expo rows: restore the row and ID if the app reports a missing project.
- Polling reads current data via Apps Script, not a public Google Sheets feed. Neither the roster nor any top-five information is delivered to judges. An overall-ranking endpoint does not exist.

## Results and ties

The private `Results` tab shows within-set place, points, rubric totals, and shared overall ranks based **only on points**. Rubric totals never break ties. Until every tableset is complete, markers are provisional. When the fifth-place boundary is tied, all affected projects are clearly marked for an organizer decision rather than selecting an arbitrary fifth team. Organizers should record their final five in a separate private decision tab so refreshing calculated results does not overwrite deliberations.

The existing public activity leaderboard uses a different sheet and is not connected to judging. Never copy private judging results into that public feed.

## Devpost import

The hackPHS Devpost gallery was unpublished when checked, so a complete direct public import was not possible. Use the official organizer flow: Manage > Metrics > Projects data > Generate report, excluding drafts and personal information > Download CSV. Upload that CSV to organizer-controlled Drive, then run **Import Devpost CSV from Drive** and supply its file ID.

Supported project-name headers: Project Name, Project Title, Submission Title, Title, Name. Optional URL and table-number headers are recognized. New project names append to Expo; existing names are skipped and no existing rows are deleted. Missing table numbers are assigned unused integers; review them before judging. Import is blocked once tablesets exist to prevent accidental assignment changes. It does not replace sample data automatically and does not claim to synchronize Devpost continuously.

Official export documentation: https://help.devpost.com/article/86-metrics-export-projects-data

## Migration and verification

Old calibration/finals sheets and local-storage records are not deleted or reinterpreted. The new workflow uses separate tables and a new storage key. Do not run old and new backends simultaneously. Backend changes in this repository do not update an already deployed Apps Script web app.

Run `node --test tests/judging.test.mjs` for locked claims, roster checks, rubric validation, ranking, ties, privacy, and live Expo updates. Before judging, smoke-test the actual deployed Apps Script with two approved judge names: they must receive different sets, cannot submit each other's scores, and must complete a full set before requesting another.
