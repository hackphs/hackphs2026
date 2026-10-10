# hackPHS 2026

The official site for hackPHS 2026

## Run locally

From the project folder run

```powershell
python wsgi.py
```

Then open [http://localhost:3000](http://localhost:3000)

Press `Ctrl+C` in the same terminal to stop the server

## Project structure

- `index.html` contains the page content and accessible markup
- `styles/` contains focused stylesheets for the layout and each visual area
- `scripts/` contains the page behavior split by responsibility
- `assets/` contains branding sponsor images and documents
- `wsgi.py` runs the small local development server

Questions about the event can be sent to [team@hackphs.tech](mailto:team@hackphs.tech)

## Waitlist

Registration and the waitlist are closed. The homepage and FAQ display the closed
status, including when JavaScript is disabled. `scripts/registration.js` shows the
registration status and waiver reminder after the hero scrolls out of view.

Registered attendees must print, complete, and
bring the [participant waiver](assets/documents/hackphs-2026-waiver.pdf) and their ID
to check-in. Participants under 18 also need a parent or legal guardian signature.
The PDF is an unchanged copy of the [organizer's waiver](https://drive.google.com/file/d/1f3cc7IwjZyQgNYhUK0EZ2owv7CxqadfT/view).

The homepage schedule and event details follow the [logistics schedule](https://docs.google.com/document/d/1FevzgA7pb0NQd2Q_zB0SGqqo3R271CZmsKuTONA4Yeo/edit?tab=t.s40dbb45azcj).
Elad Hazan's talk is **Saturday, 11:30 AM–12:30 PM**, per the organizer's correction.

## Day-of leaderboard

Open `/leaderboard.html`, also linked in the main navigation. Update scores in
the existing Google Sheet as usual. The site reads only the **Sorted Teams** tab
(gid `857309`), columns A and B, with the headers **Teams** and **Score**.
Keep that tab in the desired ranking order. Equal adjacent scores share a rank;
the site does not recalculate totals or sort the raw event scores.

The sheet must remain viewable by anyone with the link. Only share team names
and scores, not private attendee information. Sharing the whole workbook makes
its other tabs public too. For tab-only publishing, publish Sorted Teams as CSV
and replace `standingsUrl` in `scripts/leaderboard-data.js` with that published URL.

The page polls every 30 seconds while visible and refreshes when reopened or
when Refresh is clicked. Google may cache results briefly. On connection failure,
the last successful standings remain visible and are labeled as out of date.
An empty sheet shows an awaiting-scores state, not example teams. A team with a
blank score waits for a score; zero is a valid score. Formula errors are reported
as unavailable updates instead of becoming fake scores.

Event dates remain **October 10-11, 2026**, as confirmed by the organizers. The
linked event guide is maintained separately and still needs its dates corrected.

## Checks (optional, for maintainers)

### October 10 sign-ups and participant map

Workshop and competition responder links appear at **9:00 AM New York time on
Saturday, October 10, 2026** (`2026-10-10T13:00:00Z`, EDT / UTC−4). The shared
logic in `scripts/event-signups.js` updates both event dialogs and standalone
event pages, including pages left open at the release time. This is a display
schedule based on the visitor's device clock, not an access-control boundary.
The code must be deployed before release for this behavior to appear publicly.

Competition URLs are in `competitiveSignupUrls` in `scripts/events.js`. The
Estimathon form was unpublished when checked on October 9; its verified
respondent endpoint is connected but its owner still needs to publish it. No Google Form
publishing settings were changed as part of this local website update.

The participant map PDF is an unchanged copy of the organizer's supplied file.
Its PNG preview supports zoom, pan, pinch, keyboard controls and full screen;
the original PDF remains available for opening or downloading. The map's
printed event timeline has differences from the current website schedule, so
the viewer directs participants to the schedule for current times and rooms.

Run `node --test tests/event-updates.test.mjs` with Playwright available to check
release timing, responder URLs, map controls, prize updates and mobile layouts.

The website and Python preview do not need Node or npm. If Node is already
available, run the data checks with `node --test tests/data.test.mjs`.
Browser checks use Playwright and Edge: with the Python preview running and
Playwright available to Node, run `node --test tests/browser.test.mjs`.
Those checks include the real public sheet connection, mocked score updates and
outages, closed registration and waitlist status, schedule rooms, and phone layouts.
Test teams are browser-only fixtures and are never written to the Google Sheet.


## Judging portal

`/judging` (`judging/`) is where judges enter rubric scores for calibration, round 1, finals, and track prizes.
Scores go to a Google Sheet through the Apps Script in `judging/apps-script.gs`; setup steps are at the top of that file.
The deployed web app URL is set in `ENDPOINT` in `judging/judging.js`. If it is left empty the page runs in local mode
(scores stay in the browser and can be exported as CSV).
