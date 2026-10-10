// Results modal opened from the hero banner; mirrors the event dialog's open and close motion.
export function startWinners() {
    const dialog = document.querySelector("[data-winners-dialog]");
    const openButton = document.querySelector("[data-winners-open]");

    if (!dialog || !openButton) {
        return;
    }

    let closeTimer;

    const close = () => {
        if (!dialog.open || dialog.classList.contains("is-closing")) {
            return;
        }

        dialog.classList.remove("is-open");
        dialog.classList.add("is-closing");
        closeTimer = window.setTimeout(() => {
            dialog.close();
            dialog.classList.remove("is-closing");
        }, 220);
    };

    openButton.addEventListener("click", () => {
        window.clearTimeout(closeTimer);
        dialog.classList.remove("is-closing");
        dialog.showModal();
        window.requestAnimationFrame(() => dialog.classList.add("is-open"));
    });

    dialog.querySelector("[data-winners-close]").addEventListener("click", close);
    dialog.addEventListener("cancel", (cancelEvent) => {
        cancelEvent.preventDefault();
        close();
    });
    dialog.addEventListener("click", (clickEvent) => {
        if (clickEvent.target === dialog) {
            close();
        }
    });
}
