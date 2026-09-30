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

Registration is closed. The homepage and FAQ link directly to the waitlist form
in `index.html`, including when JavaScript is disabled. `scripts/registration.js`
only shows the reminder bar after the hero scrolls out of view.

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

The website and Python preview do not need Node or npm. If Node is already
available, run the data checks with `node --test tests/data.test.mjs`.
Browser checks use Playwright and Edge: with the Python preview running and
Playwright available to Node, run `node --test tests/browser.test.mjs`.
Those checks include the real public sheet connection, mocked score updates and
outages, the midnight waitlist switch, schedule rooms, and phone layouts.
Test teams are browser-only fixtures and are never written to the Google Sheet.

