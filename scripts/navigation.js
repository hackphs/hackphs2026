export function startNavigation() {
    const navigation = document.querySelector("[data-site-nav]");
    const yearsMenu = document.querySelector(".years-menu");

    // keep the home address tidy after someone taps the logo
    if (window.location.hash === "#top") {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }

    navigation?.querySelectorAll("a[href^='#']").forEach((link) => {
        link.addEventListener("click", () => yearsMenu?.removeAttribute("open"));
    });

    if (!yearsMenu) {
        return;
    }

    const summary = yearsMenu.querySelector("summary");
    const supportsHover = window.matchMedia("(hover: hover)");

    yearsMenu.addEventListener("pointerenter", () => {
        if (supportsHover.matches) {
            yearsMenu.setAttribute("open", "");
        }
    });
    yearsMenu.addEventListener("pointerleave", () => {
        if (supportsHover.matches) {
            yearsMenu.removeAttribute("open");
        }
    });
    summary?.addEventListener("click", (event) => {
        if (supportsHover.matches && event.detail > 0) {
            event.preventDefault();
            yearsMenu.setAttribute("open", "");
        }
    });
    yearsMenu.addEventListener("focusout", (event) => {
        if (!yearsMenu.contains(event.relatedTarget)) {
            yearsMenu.removeAttribute("open");
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            yearsMenu.removeAttribute("open");
        }
    });
}
