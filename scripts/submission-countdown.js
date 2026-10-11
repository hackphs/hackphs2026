export const SUBMISSION_DEADLINE = Date.parse("2026-10-11T10:30:00-04:00");

export function submissionTimeLeft(now = Date.now()) {
    const minutes = Math.ceil((SUBMISSION_DEADLINE - now) / 60000);
    return minutes > 0 ? `${minutes} ${minutes === 1 ? "minute" : "minutes"} left` : "Submission deadline has passed";
}

export function startSubmissionCountdown() {
    const label = document.querySelector("[data-submission-countdown]");
    if (!label) return;
    const update = () => {
        const message = submissionTimeLeft();
        if (label.textContent !== message) label.textContent = message;
    };
    update();
    const interval = setInterval(() => {
        update();
        if (Date.now() >= SUBMISSION_DEADLINE) clearInterval(interval);
    }, 1000);
}
