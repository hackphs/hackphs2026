export const recapSeenKey = "hackphs2026-recap-seen";

export function startRecap() {
    const dialog = document.querySelector("[data-recap-dialog]");
    const trigger = document.querySelector("[data-recap-open]");
    if (!dialog || !trigger || typeof dialog.showModal !== "function") return;
    const video = dialog.querySelector("[data-recap-video]");
    let returnFocus = trigger;
    const open = (automatic = false) => {
        if (document.querySelector("dialog[open]")) return;
        returnFocus = automatic ? trigger : document.activeElement;
        if (!video.hasAttribute("src")) {
            video.src = video.dataset.videoSrc;
            video.preload = "metadata";
        }
        dialog.showModal();
        document.documentElement.classList.add("has-recap-dialog");
    };
    trigger.addEventListener("click", (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        open();
    });
    dialog.querySelector("[data-recap-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener("close", () => {
        video.pause();
        document.documentElement.classList.remove("has-recap-dialog");
        try { sessionStorage.setItem(recapSeenKey, "1"); } catch { /* Storage can be disabled. */ }
        if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    });
    video.addEventListener("error", () => { dialog.querySelector("[data-recap-error]").hidden = false; });

    const welcome = () => {
        if (window.location.hash === "#recap") { open(true); return; }
        if (window.location.hash && window.location.hash !== "#top") return;
        let seen = false;
        try { seen = sessionStorage.getItem(recapSeenKey) === "1"; } catch { /* Still allow the welcome. */ }
        if (!seen) open(true);
    };
    if (document.readyState === "complete") welcome();
    else window.addEventListener("load", welcome, { once: true });
}
