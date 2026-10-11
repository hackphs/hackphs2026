# Tableset judging

## Current organizer workspace

After filling Expo and Judges, use **Preassign first round** below the roster in **Judges** (columns D/E). The existing edit trigger reserves up to five projects for each judge with no previous assignment, then reports the result below the checkbox and unchecks it. Repeated clicks preserve existing sets and scores. With five test projects, only three full sets can be reserved; remaining judges must wait for more projects. Run `enableLiveJudgeUpdates()` once after installing this version to place the controls and remove the former separate control tab. Keep column A reserved for actual judge names. No website deployment is needed. Preassigned sign-ins skip assignment creation and report rebuilding; subsequent requested sets still reserve eligible projects live.

Use the original **HACKPHS26 Judging Process** workbook for all daily work. It is Restricted to named organizers, including the backend account. `Review Board` shows assignments and awarded points by judge with totals; `Judge Notes` shows saved feedback with readable project names; `Results` shows private standings. `Expo` and `Judges` remain the editable project and judge source. Column E of Expo counts reviews remaining (3/2/1/0).

`consolidateOrganizerWorkbook()` copies and verifies existing raw Scores/Tablesets under the same lock used for judging, then switches `JUDGING_PRIVATE_SHEET_ID` to the original source. The former private workbook is retained as a frozen backup via `JUDGING_BACKUP_SHEET_ID`, not a second live score source. The separate Website workbook only hosts the existing Apps Script deployment; organizers do not need to use it. Never delete that host without moving/redeploying the script.

All scores, assignments, notes, and reports now live in the original workbook. Keep it Restricted; if made public again, judging fails closed. The API executes as the authorized backend account, so private sharing does not prevent live website reads/writes. No spreadsheet links or overall results are returned to judges.

## Deploy before using the updated website

1. Open the source spreadsheet as a trusted organizer. Extensions > Apps Script: replace the backend with `apps-script.gs`.
2. Run `setup` and authorize access. The source ID is configured in the backend. This creates a separate **restricted** scoring workbook, stores its ID in `JUDGING_PRIVATE_SHEET_ID`, and sets `JUDGE_INVITATION` to `Invitation` (case-sensitive).
3. Keep the scoring workbook accessible only to organizers. Never publish it or share it with judges/participants. Hidden tabs are not a security boundary. For the consolidated production setup, the source IS the scoring workbook and must remain Restricted.
4. Check `Judges` has unique names in `Name`. Check `Expo` has `Project Name` and `Table #` (also accepts `Project Table`). Optional columns: `Project Link`, `Track`. Remove sample projects before going live. Duplicate names or missing table values are errors.
5. Run `buildTablesets` (Prepare three-review judging). It preserves existing assignments and scores, adds a persistent `Judging ID` if missing, and refreshes progress reports. Do not edit these IDs. Whole-row sorting is safe. Sets are now randomized when claimed, not prebuilt in table order. Each project reserves at most three slots for distinct judges. A batch may have fewer than five eligible projects; none are discarded.
6. Deploy > Manage deployments > Edit > New version. Execute as the organizer and allow Anyone to reach the web app. Application-level authentication requires BOTH a roster name and the invitation on every request. If creating a new deployment, update `ENDPOINT` in `judging.js`.
7. Results and Expo review-progress columns refresh when a set is assigned or completed. You can also run `computeResults` from the organizer menu. Overall points/results are written only to the private workbook, never returned by the web app. The prior tableset frontend remains compatible during rollout; calibration/finals requests are rejected.

The source spreadsheet URL and ID are not in frontend JS/HTML. The local server blocks `.gs` files; `_config.yml` excludes the backend from GitHub Pages/Jekyll output. If using a different hosting pipeline, explicitly exclude `.gs`, organizer documentation, and private artifacts from the deployed directory. A private repository alone does not prevent a web server from serving files copied into its public directory.

## Judge flow and live edits

- Heavy-load mode staggers background browser refreshes every 120-150 seconds and throttles repeated focus refreshes to at most one per 20 seconds. Saves and explicit assignment requests remain immediate. Only polling project metadata is cached for 15 seconds, with Expo-edit invalidation and uncached fallbacks for newly assigned projects or final completion checks. Authentication, scores, reservations, and write validation remain fresh and uncached.

- Run `enableDeferredJudgingReports()` once, then deploy the updated backend and website. This installs an idempotent one-minute report worker and enables deferred reporting only after the trigger exists. Raw scores and assignments save before acknowledgment; Review Board, Judge Notes, Results, and Expo progress follow on the next background refresh, usually about a minute (longer under contention). Failed or busy refreshes retain a dirty marker for the next run. Until enabled, synchronous reporting remains the fallback. Do not delete the worker trigger while deferred reporting is enabled.
- Judge writes retain the shared lock and three-review cap. Busy lock rejections are retried up to five times with increasing randomized delays and a visible waiting message. This is not a numbered FIFO queue. Network failures are not blindly retried as writes may already have committed; drafts are preserved and the UI says the save is unconfirmed. Locks are released only after pending spreadsheet writes are flushed.

- Run `enableLiveJudgeUpdates` once after deploying the backend update. It installs edit/change triggers on the original organizer workbook (not the script-host workbook). Editing or pasting names in `Judges` then refreshes Review Board, Judge Notes, Results, and Expo progress automatically. The script also reconciles names on authenticated requests as a fallback.
- Each Judges row has a hidden `Judging Judge ID`; assignments and scores store that ID alongside the display name. Change the existing Name cell to rename a judge, and sort whole rows rather than only the Name column. Never delete or replace IDs. Existing scores and assignments follow renames, including bulk name swaps. A removed judge's history is preserved; reusing their name for a different ID is rejected to avoid merging scores. Judges must sign in again using their updated name.
- Review Board uses automatic conditional fills: 15 green, 10 yellow, 5 blue, 0 gray. Blank means no finished review and has no fill. These rules follow new judge columns and do not affect scores or overall ranking.
- Sign in with a name matching `Judges!Name` (case and extra whitespace ignored), plus `Invitation`. No public judge-name dropdown. Credentials are kept in memory only. Names are checked server-side on every request.
- The first sign-in atomically reserves up to five random projects. Projects with fewer reserved reviews are prioritized. One judge can have only one unfinished set and never sees the same project twice. Each project receives three reviews from distinct judges; at least three participating judges are needed. Extra sets are available after the current set is finished. There is no automatic timeout/reassignment that could take work away from a judge.
- Save a 1-12 score for all five unchanged rubric criteria. Weighted totals remain out of 48 for reference, not overall ranking. Unsaved drafts stay on the device; successful saves require server confirmation. Drafts do not count as completed scores.
- Saved rubric totals automatically rank the set; only equal totals need a judge's tie decision. The server rejects rankings contrary to saved totals, awards 15, 10, 5, 0, 0, and locks the set. Repeating an identical completion request is safe.
- Roster validation is live. Project names/table numbers refresh every 30 seconds and on focus. Stable IDs retain scores across edits. New projects enter the eligible pool for three reviews; assigned sets never change membership. Do not delete assigned Expo rows. Duplicate source table numbers are flagged, never silently renumbered.
- Polling reads current data via Apps Script, not a public Google Sheets feed. Neither the roster nor any top-five information is delivered to judges. An overall-ranking endpoint does not exist.

## Results and ties

The private `Results` tab has one row per project with completed review count, reviewed-by and in-progress judge names, summed points across three reviews (maximum 45), summed rubric totals (maximum 144), and shared ranks based **only on points**. Rubric totals never break ties. Rankings remain provisional until all reviews finish. Record final decisions in Organizer Notes or a separate private tab so report refreshes do not overwrite deliberations.

`Results` keeps Table but omits Reviews required and Top 5 status. Edit project names or table numbers in Expo: the installed edit trigger refreshes Results, Review Board, Judge Notes, and assigned project details automatically. Adding, clearing, or deleting Expo project rows resizes the reports, including an empty project list. Removed projects retain their raw scores and assignment history; deleting an already-assigned project still blocks judge workflows until restored, rather than silently changing a live ranking. Duplicate queued edits skip report rebuilds. Pending status is cream and Completed is green. No top-five markers are generated. Record manual tie decisions in Expo's Organizer Notes or a separate private decisions tab; generated Results cells are refreshed by the backend. Review Board trims unused trailing columns to the current roster plus any former judges with saved reviews; adding a judge automatically adds a column.

## Organizer tabs and backend storage

- Original source: edit `Judges` and the project details in `Expo`. Column E (`Reviews Remaining`, formerly `Beginner?`) automatically counts down 3/2/1/0 as distinct judges finish their sets; an assignment or draft score does not reduce it. The old manual judge columns and old Total are legacy template data, NOT website scores. They and the technical ID/progress columns are hidden for clarity, not deleted. The visible `Organizer Notes` column is organizer-entered, not judge feedback. The stable Judging IDs must be preserved. Unhide the technical columns if investigating duplicate tables or review counts.
- Same original workbook after consolidation: use `Review Board` day-to-day. It shows table, project, pending judges (including unassigned review slots), a points column for each roster/historical judge, and total points on the right. Blank means no completed review; **0 means a completed review with zero awarded points**. Awards are 15/10/5/0/0, totals max 45. `Judge Notes` shows saved feedback by project name and judge, including in-progress reviews; it refreshes whenever a judge saves. `Results` retains private overall standings. Raw `Scores` and `Tablesets` are backend storage. Keep this workbook Restricted.
- Judging (Website): only hosts the bound Apps Script. Its legacy data tabs are not read. You only manage the original workbook; do not delete the script-host workbook while its deployment is in use.

The existing public activity leaderboard uses a different sheet and is not connected to judging. Never copy private judging results into that public feed.

## Devpost import

The hackPHS Devpost gallery was unpublished when checked, so a complete direct public import was not possible. Use the official organizer flow: Manage > Metrics > Projects data > Generate report, excluding drafts and personal information > Download CSV. Upload that CSV to organizer-controlled Drive, then run **Import Devpost CSV from Drive** and supply its file ID.

Supported project-name headers: Project Name, Project Title, Submission Title, Title, Name. Optional URL and table-number headers are recognized. New project names append to Expo; existing names are skipped and no existing rows are deleted. Missing table numbers are assigned unused integers; review them before judging. Import is blocked once sets are assigned. It does not replace sample data automatically and does not synchronize Devpost continuously.

Official export documentation: https://help.devpost.com/article/86-metrics-export-projects-data

## Migration and verification

Old calibration/finals sheets and local-storage records are not deleted or reinterpreted. The new workflow uses separate tables and a new storage key. Do not run old and new backends simultaneously. Backend changes in this repository do not update an already deployed Apps Script web app.

Run `node --test tests/judging.test.mjs` for locked claims, roster checks, rubric validation, ranking, ties, privacy, and live Expo updates. Before judging, smoke-test the actual deployed Apps Script with two approved judge names: they must receive different sets, cannot submit each other's scores, and must complete a full set before requesting another.
