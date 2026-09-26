export const standingsUrl = "https://docs.google.com/spreadsheets/d/1_r2inZiMa1JkOqW5_fbz8bgn4ONDuzpWf_T1qAirirg/gviz/tq?gid=857309&headers=1&range=A:B&tqx=out:csv";

export function parseCsv(csv) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    let quoteClosed = false;

    for (const character of csv.replace(/^\uFEFF/, "")) {
        if (quoted) {
            if (character === '"') {
                quoted = false;
                quoteClosed = true;
            } else {
                value += character;
            }
        } else if (character === '"' && quoteClosed) {
            value += '"';
            quoted = true;
            quoteClosed = false;
        } else if (character === '"' && !value && !quoteClosed) {
            quoted = true;
        } else if (character === "," || character === "\n") {
            row.push(value);
            value = "";
            quoteClosed = false;
            if (character === "\n") {
                rows.push(row);
                row = [];
            }
        } else if (character !== "\r") {
            if (quoteClosed) throw new Error("Invalid quoted CSV field");
            value += character;
        }
    }

    if (quoted) throw new Error("Incomplete CSV response");
    row.push(value);
    rows.push(row);
    return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

export function parseStandings(csv) {
    const [header, ...rows] = parseCsv(csv);
    if (header?.length !== 2 || header[0].trim().toLowerCase() !== "teams"
        || header[1].trim().toLowerCase() !== "score") {
        throw new Error("Expected Teams and Score columns from Sorted Teams");
    }

    const teams = [];
    let pending = 0;
    for (const cells of rows) {
        const name = cells[0]?.trim();
        if (!name) continue;
        if (cells.length !== 2 || /^#(?:REF!|N\/A|VALUE!|DIV\/0!|NAME\?|NUM!|ERROR!|SPILL!|CALC!|NULL!)$/.test(name)) {
            throw new Error("The rankings sheet has an invalid row");
        }
        const scoreText = cells[1].trim();
        if (!scoreText) {
            pending += 1;
            continue;
        }
        if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(scoreText)) {
            throw new Error("The rankings sheet has an invalid score");
        }
        const score = Number(scoreText.replaceAll(",", ""));
        if (!Number.isFinite(score)) throw new Error("Score is out of range");

        // The sheet owns the order and totals. We only number the places.
        const previous = teams.at(-1);
        teams.push({ name, score, rank: previous?.score === score ? previous.rank : teams.length + 1 });
    }
    return { teams, pending };
}

export async function fetchStandings({ signal, fetcher = fetch } = {}) {
    const response = await fetcher(standingsUrl, { signal, cache: "no-store", credentials: "omit" });
    if (!response.ok) throw new Error(`Scores unavailable (${response.status})`);
    return parseStandings(await response.text());
}
