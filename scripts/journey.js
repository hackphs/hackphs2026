export function startJourney() {
    const root = document.documentElement;
    const background = document.querySelector(".journey-background");
    const header = document.querySelector("[data-site-header]");
    const plane = document.querySelector("[data-journey-plane]");
    const starField = document.querySelector("[data-star-field]");
    const sections = [...document.querySelectorAll("[data-stage]")];
    const birds = document.querySelector(".journey-birds");
    const wind = document.querySelector(".journey-wind");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let layoutChanged = true;
    let sectionPositions = [];
    let viewportHeight = window.innerHeight;
    let viewportWidth = window.innerWidth;
    let scrollableHeight = 1;
    let lastProgress = "";

    // the stars stay familiar instead of changing on every refresh
    if (starField) {
        let seed = 2026;
        const random = () => {
            seed += 0x6d2b79f5;
            let value = seed;
            value = Math.imul(value ^ (value >>> 15), value | 1);
            value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
            return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };
        const stars = document.createDocumentFragment();
        const starCount = window.innerWidth < 640 ? 74 : 128;

        for (let index = 0; index < starCount; index += 1) {
            const star = document.createElement("span");
            const size = random() * 2.1 + 0.7;

            star.style.left = `${random() * 100}%`;
            star.style.top = `${random() * 84}%`;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.setProperty("--star-speed", `${random() * 4 + 3}s`);
            star.style.setProperty("--star-delay", `${random() * -5}s`);
            stars.append(star);
        }

        starField.replaceChildren(stars);
    }

    const update = () => {
        animationFrame = 0;

        const scrollTop = window.scrollY;
        if (layoutChanged) {
            viewportHeight = window.innerHeight;
            viewportWidth = window.innerWidth;
            scrollableHeight = Math.max(root.scrollHeight - viewportHeight, 1);
            sectionPositions = sections.map((section) => {
                const bounds = section.getBoundingClientRect();
                return { top: bounds.top + scrollTop, bottom: bounds.bottom + scrollTop, stage: section.dataset.stage };
            });
            layoutChanged = false;
        }
        const progress = Math.min(Math.max(scrollTop / scrollableHeight, 0), 1);
        const focusLine = scrollTop + viewportHeight * 0.48;
        const stage = sectionPositions.find((section) => section.top <= focusLine && section.bottom > focusLine)?.stage ?? "night";

        if (document.body.dataset.stage !== stage) document.body.dataset.stage = stage;
        header?.classList.toggle("is-scrolled", scrollTop > 20);
        starField?.classList.toggle("is-motion-paused", progress >= 1.1 / 3);
        birds?.classList.toggle("is-motion-paused", progress <= 0.19);
        wind?.classList.toggle("is-motion-paused", progress <= (viewportWidth <= 640 ? 0.16 : 0.14));

        // Only the backdrop uses this value; don't invalidate styles across the whole page.
        const nextProgress = progress.toFixed(4);
        if (nextProgress === lastProgress) return;
        lastProgress = nextProgress;
        background?.style.setProperty("--journey", nextProgress);

        if (plane) {
            const x = 8 + progress * 84;
            const y = 76 - Math.sin(progress * Math.PI) * 48 + Math.sin(progress * Math.PI * 7) * 5;
            const xVelocity = viewportWidth * 0.84;
            const yVelocity = (
                -48 * Math.PI * Math.cos(progress * Math.PI)
                + 35 * Math.PI * Math.cos(progress * Math.PI * 7)
            ) * viewportHeight / 100;
            const angle = Math.atan2(yVelocity, xVelocity) * 180 / Math.PI;

            plane.style.setProperty("--plane-x", `${x.toFixed(2)}vw`);
            plane.style.setProperty("--plane-y", `${y.toFixed(2)}vh`);
            plane.style.setProperty("--plane-rotation", `${angle.toFixed(2)}deg`);
        }
    };

    const requestUpdate = () => {
        if (!animationFrame && !document.hidden) {
            animationFrame = window.requestAnimationFrame(update);
        }
    };

    const refreshLayout = () => {
        layoutChanged = true;
        lastProgress = "";
        requestUpdate();
    };

    const syncPlayback = () => {
        background?.classList.toggle("is-motion-paused", document.hidden || reducedMotion.matches);
        if (document.hidden) {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = 0;
        } else {
            refreshLayout();
        }
    };

    update();
    syncPlayback();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", refreshLayout);
    const layoutObserver = new ResizeObserver(refreshLayout);
    layoutObserver.observe(document.body);
    sections.forEach((section) => layoutObserver.observe(section));
    document.addEventListener("visibilitychange", syncPlayback);
    reducedMotion.addEventListener("change", syncPlayback);
}
