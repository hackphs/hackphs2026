export function startJourney() {
    const root = document.documentElement;
    const header = document.querySelector("[data-site-header]");
    const plane = document.querySelector("[data-journey-plane]");
    const starField = document.querySelector("[data-star-field]");
    const sections = [...document.querySelectorAll("[data-stage]")];
    let animationFrame = 0;

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

        const scrollableHeight = Math.max(root.scrollHeight - window.innerHeight, 1);
        const progress = Math.min(Math.max(window.scrollY / scrollableHeight, 0), 1);
        const focusLine = window.innerHeight * 0.48;
        const activeSection = sections.find((section) => {
            const bounds = section.getBoundingClientRect();
            return bounds.top <= focusLine && bounds.bottom > focusLine;
        });

        root.style.setProperty("--journey", progress.toFixed(4));
        document.body.dataset.stage = activeSection?.dataset.stage ?? "night";
        header?.classList.toggle("is-scrolled", window.scrollY > 20);

        if (plane) {
            const x = 8 + progress * 84;
            const y = 76 - Math.sin(progress * Math.PI) * 48 + Math.sin(progress * Math.PI * 7) * 5;
            const xVelocity = window.innerWidth * 0.84;
            const yVelocity = (
                -48 * Math.PI * Math.cos(progress * Math.PI)
                + 35 * Math.PI * Math.cos(progress * Math.PI * 7)
            ) * window.innerHeight / 100;
            const angle = Math.atan2(yVelocity, xVelocity) * 180 / Math.PI;

            plane.style.setProperty("--plane-x", `${x.toFixed(2)}vw`);
            plane.style.setProperty("--plane-y", `${y.toFixed(2)}vh`);
            plane.style.setProperty("--plane-rotation", `${angle.toFixed(2)}deg`);
        }
    };

    const requestUpdate = () => {
        if (!animationFrame) {
            animationFrame = window.requestAnimationFrame(update);
        }
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
}
