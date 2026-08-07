const root = document.documentElement;
const body = document.body;
const starField = document.querySelector("[data-star-field]");
const journeyPlane = document.querySelector("[data-journey-plane]");
const siteHeader = document.querySelector("[data-site-header]");
const siteNav = document.querySelector("[data-site-nav]");
const yearsMenu = document.querySelector(".years-menu");
const rocket = document.querySelector("[data-rocket]");
const sections = [...document.querySelectorAll("[data-stage]")];
const revealItems = [...document.querySelectorAll(".reveal")];

let scrollFrame = 0;

function clamp(value, minimum = 0, maximum = 1) {
    return Math.min(Math.max(value, minimum), maximum);
}

function seededRandom(seed) {
    let value = seed >>> 0;

    return function random() {
        value += 0x6d2b79f5;
        let result = value;
        result = Math.imul(result ^ (result >>> 15), result | 1);
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}

function buildStars() {
    if (!starField) {
        return;
    }

    const random = seededRandom(2026);
    const starCount = window.innerWidth < 640 ? 74 : 128;
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < starCount; index += 1) {
        const star = document.createElement("span");
        const size = random() * 2.1 + 0.7;

        star.style.left = `${random() * 100}%`;
        star.style.top = `${random() * 84}%`;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.setProperty("--star-speed", `${random() * 4 + 3}s`);
        star.style.setProperty("--star-delay", `${random() * -5}s`);
        fragment.append(star);
    }

    starField.replaceChildren(fragment);
}

function getActiveStage() {
    const focusLine = window.innerHeight * 0.48;
    let activeStage = sections[0]?.dataset.stage || "night";

    sections.forEach((section) => {
        const rect = section.getBoundingClientRect();

        if (rect.top <= focusLine && rect.bottom > focusLine) {
            activeStage = section.dataset.stage;
        }
    });

    return activeStage;
}

function updateJourneyPlane(progress) {
    if (!journeyPlane) {
        return;
    }

    const x = 8 + (progress * 84);
    const y = 76 - (Math.sin(progress * Math.PI) * 48) + (Math.sin(progress * Math.PI * 7) * 5);
    const xDerivative = 0.84 * window.innerWidth;
    const yDerivative = (
        (-48 * Math.PI * Math.cos(progress * Math.PI)) +
        (35 * Math.PI * Math.cos(progress * Math.PI * 7))
    ) * window.innerHeight / 100;
    const rotation = Math.atan2(yDerivative, xDerivative) * (180 / Math.PI);

    journeyPlane.style.setProperty("--plane-x", `${x.toFixed(2)}vw`);
    journeyPlane.style.setProperty("--plane-y", `${y.toFixed(2)}vh`);
    journeyPlane.style.setProperty("--plane-rotation", `${rotation.toFixed(2)}deg`);
}

function updateJourney() {
    scrollFrame = 0;
    const scrollableHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const progress = clamp(window.scrollY / scrollableHeight);

    root.style.setProperty("--journey", progress.toFixed(4));
    updateJourneyPlane(progress);
    body.dataset.stage = getActiveStage();
    siteHeader?.classList.toggle("is-scrolled", window.scrollY > 20);
}

function queueJourneyUpdate() {
    if (scrollFrame) {
        return;
    }

    scrollFrame = window.requestAnimationFrame(updateJourney);
}

function setupRevealObserver() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        revealItems.forEach((item) => item.classList.add("is-visible"));
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        {
            rootMargin: "0px 0px -12%",
            threshold: 0.12,
        },
    );

    revealItems.forEach((item) => observer.observe(item));
}

function setupNavigation() {
    siteNav?.querySelectorAll("a[href^='#']").forEach((link) => {
        link.addEventListener("click", () => yearsMenu?.removeAttribute("open"));
    });

    yearsMenu?.addEventListener("pointerenter", () => {
        yearsMenu.setAttribute("open", "");
    });

    yearsMenu?.addEventListener("pointerleave", () => {
        yearsMenu.removeAttribute("open");
    });

    yearsMenu?.addEventListener("focusin", () => {
        yearsMenu.setAttribute("open", "");
    });

    yearsMenu?.addEventListener("focusout", (event) => {
        if (!yearsMenu.contains(event.relatedTarget)) {
            yearsMenu.removeAttribute("open");
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            yearsMenu?.removeAttribute("open");
        }
    });
}

function setupRocket() {
    if (!rocket) {
        return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        rocket.classList.remove("is-intro");
        rocket.classList.add("is-orbiting");
        return;
    }

    function finishRocketEntry(event) {
        if (event.target !== rocket || event.animationName !== "rocket-entry") {
            return;
        }

        rocket.classList.remove("is-intro");
        rocket.classList.add("is-orbiting");
        rocket.removeEventListener("animationend", finishRocketEntry);
    }

    rocket.addEventListener("animationend", finishRocketEntry);
}

buildStars();
setupRevealObserver();
setupNavigation();
setupRocket();
updateJourney();

window.addEventListener("scroll", queueJourneyUpdate, { passive: true });
window.addEventListener("resize", queueJourneyUpdate);
