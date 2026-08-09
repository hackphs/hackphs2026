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
    if (window.location.hash === "#top") {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }

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

function cubicPoint(start, controlOne, controlTwo, end, progress) {
    const inverse = 1 - progress;

    return {
        x:
            (inverse ** 3 * start.x) +
            (3 * inverse ** 2 * progress * controlOne.x) +
            (3 * inverse * progress ** 2 * controlTwo.x) +
            (progress ** 3 * end.x),
        y:
            (inverse ** 3 * start.y) +
            (3 * inverse ** 2 * progress * controlOne.y) +
            (3 * inverse * progress ** 2 * controlTwo.y) +
            (progress ** 3 * end.y),
    };
}

function cubicDerivative(start, controlOne, controlTwo, end, progress) {
    const inverse = 1 - progress;

    return {
        x:
            (3 * inverse ** 2 * (controlOne.x - start.x)) +
            (6 * inverse * progress * (controlTwo.x - controlOne.x)) +
            (3 * progress ** 2 * (end.x - controlTwo.x)),
        y:
            (3 * inverse ** 2 * (controlOne.y - start.y)) +
            (6 * inverse * progress * (controlTwo.y - controlOne.y)) +
            (3 * progress ** 2 * (end.y - controlTwo.y)),
    };
}

function cubicSecondDerivative(start, controlOne, controlTwo, end, progress) {
    return {
        x: 6 * (
            ((1 - progress) * (controlTwo.x - (2 * controlOne.x) + start.x)) +
            (progress * (end.x - (2 * controlTwo.x) + controlOne.x))
        ),
        y: 6 * (
            ((1 - progress) * (controlTwo.y - (2 * controlOne.y) + start.y)) +
            (progress * (end.y - (2 * controlTwo.y) + controlOne.y))
        ),
    };
}

function quinticPoint(
    start,
    startVelocity,
    startAcceleration,
    end,
    endVelocity,
    endAcceleration,
    duration,
    progress,
) {
    const square = progress ** 2;
    const cube = progress ** 3;
    const fourth = progress ** 4;
    const fifth = progress ** 5;
    const startPositionBasis = 1 - (10 * cube) + (15 * fourth) - (6 * fifth);
    const startVelocityBasis = progress - (6 * cube) + (8 * fourth) - (3 * fifth);
    const startAccelerationBasis = (square - (3 * cube) + (3 * fourth) - fifth) / 2;
    const endPositionBasis = (10 * cube) - (15 * fourth) + (6 * fifth);
    const endVelocityBasis = (-4 * cube) + (7 * fourth) - (3 * fifth);
    const endAccelerationBasis = (cube - (2 * fourth) + fifth) / 2;
    const durationSquared = duration ** 2;

    return {
        x:
            (startPositionBasis * start.x) +
            (startVelocityBasis * startVelocity.x * duration) +
            (startAccelerationBasis * startAcceleration.x * durationSquared) +
            (endPositionBasis * end.x) +
            (endVelocityBasis * endVelocity.x * duration) +
            (endAccelerationBasis * endAcceleration.x * durationSquared),
        y:
            (startPositionBasis * start.y) +
            (startVelocityBasis * startVelocity.y * duration) +
            (startAccelerationBasis * startAcceleration.y * durationSquared) +
            (endPositionBasis * end.y) +
            (endVelocityBasis * endVelocity.y * duration) +
            (endAccelerationBasis * endAcceleration.y * durationSquared),
    };
}

function quinticDerivative(
    start,
    startVelocity,
    startAcceleration,
    end,
    endVelocity,
    endAcceleration,
    duration,
    progress,
) {
    const square = progress ** 2;
    const cube = progress ** 3;
    const fourth = progress ** 4;
    const startPositionBasis = (-30 * square) + (60 * cube) - (30 * fourth);
    const startVelocityBasis = 1 - (18 * square) + (32 * cube) - (15 * fourth);
    const startAccelerationBasis = ((2 * progress) - (9 * square) + (12 * cube) - (5 * fourth)) / 2;
    const endPositionBasis = (30 * square) - (60 * cube) + (30 * fourth);
    const endVelocityBasis = (-12 * square) + (28 * cube) - (15 * fourth);
    const endAccelerationBasis = ((3 * square) - (8 * cube) + (5 * fourth)) / 2;
    const durationSquared = duration ** 2;

    return {
        x:
            (startPositionBasis * start.x) +
            (startVelocityBasis * startVelocity.x * duration) +
            (startAccelerationBasis * startAcceleration.x * durationSquared) +
            (endPositionBasis * end.x) +
            (endVelocityBasis * endVelocity.x * duration) +
            (endAccelerationBasis * endAcceleration.x * durationSquared),
        y:
            (startPositionBasis * start.y) +
            (startVelocityBasis * startVelocity.y * duration) +
            (startAccelerationBasis * startAcceleration.y * durationSquared) +
            (endPositionBasis * end.y) +
            (endVelocityBasis * endVelocity.y * duration) +
            (endAccelerationBasis * endAcceleration.y * durationSquared),
    };
}

function setupRocket() {
    const orbit = rocket?.closest(".rocket-orbit");

    if (!rocket || !orbit) {
        return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const chaosDuration = 4000;
    const landingDuration = 1800;
    const approachDuration = chaosDuration + landingDuration;
    const orbitDuration = 10000;
    const angularVelocity = (Math.PI * 2) / orbitDuration;
    let startTime = 0;

    function getOrbitGeometry() {
        const width = orbit.clientWidth;
        const height = orbit.clientHeight;

        return {
            centerX: width / 2,
            centerY: height / 2,
            radiusX: (width / 2) - 10,
            radiusY: (height / 2) - 8,
        };
    }

    function placeRocket(point, tangent) {
        const angle = Math.atan2(tangent.y, tangent.x) * (180 / Math.PI);
        const x = point.x - (rocket.offsetWidth / 2);
        const y = point.y - (rocket.offsetHeight / 2);

        rocket.style.opacity = "1";
        rocket.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${angle.toFixed(2)}deg)`;
    }

    function renderRocket(time) {
        if (!startTime) {
            startTime = time;
        }

        const elapsed = time - startTime;
        const geometry = getOrbitGeometry();

        if (reducedMotion) {
            const angle = Math.PI;
            placeRocket(
                {
                    x: geometry.centerX + (geometry.radiusX * Math.cos(angle)),
                    y: geometry.centerY + (geometry.radiusY * Math.sin(angle)),
                },
                {
                    x: -geometry.radiusX * Math.sin(angle),
                    y: geometry.radiusY * Math.cos(angle),
                },
            );
            return;
        }

        if (elapsed < approachDuration) {
            const scaleX = orbit.clientWidth / 368;
            const scaleY = orbit.clientHeight / 224;
            const start = { x: -720 * scaleX, y: -250 * scaleY };
            const chaosControlOne = { x: -560 * scaleX, y: 390 * scaleY };
            const chaosControlTwo = { x: -180 * scaleX, y: -360 * scaleY };
            const chaosEnd = { x: 320 * scaleX, y: -170 * scaleY };

            if (elapsed < chaosDuration) {
                const progress = clamp(elapsed / chaosDuration);

                placeRocket(
                    cubicPoint(start, chaosControlOne, chaosControlTwo, chaosEnd, progress),
                    cubicDerivative(start, chaosControlOne, chaosControlTwo, chaosEnd, progress),
                );
            } else {
                const progress = clamp((elapsed - chaosDuration) / landingDuration);
                const landingEnd = {
                    x: geometry.centerX - geometry.radiusX,
                    y: geometry.centerY,
                };
                const landingStartVelocity = cubicDerivative(
                    start,
                    chaosControlOne,
                    chaosControlTwo,
                    chaosEnd,
                    1,
                );
                const landingStartAcceleration = cubicSecondDerivative(
                    start,
                    chaosControlOne,
                    chaosControlTwo,
                    chaosEnd,
                    1,
                );
                const orbitVelocity = {
                    x: 0,
                    y: -geometry.radiusY * angularVelocity,
                };
                const orbitAcceleration = {
                    x: geometry.radiusX * angularVelocity ** 2,
                    y: 0,
                };
                const normalizedStartVelocity = {
                    x: landingStartVelocity.x / chaosDuration,
                    y: landingStartVelocity.y / chaosDuration,
                };
                const normalizedStartAcceleration = {
                    x: landingStartAcceleration.x / chaosDuration ** 2,
                    y: landingStartAcceleration.y / chaosDuration ** 2,
                };

                placeRocket(
                    quinticPoint(
                        chaosEnd,
                        normalizedStartVelocity,
                        normalizedStartAcceleration,
                        landingEnd,
                        orbitVelocity,
                        orbitAcceleration,
                        landingDuration,
                        progress,
                    ),
                    quinticDerivative(
                        chaosEnd,
                        normalizedStartVelocity,
                        normalizedStartAcceleration,
                        landingEnd,
                        orbitVelocity,
                        orbitAcceleration,
                        landingDuration,
                        progress,
                    ),
                );
            }

            rocket.style.opacity = `${clamp(elapsed / 280).toFixed(3)}`;
        } else {
            const angle = Math.PI + ((elapsed - approachDuration) * angularVelocity);

            placeRocket(
                {
                    x: geometry.centerX + (geometry.radiusX * Math.cos(angle)),
                    y: geometry.centerY + (geometry.radiusY * Math.sin(angle)),
                },
                {
                    x: -geometry.radiusX * Math.sin(angle),
                    y: geometry.radiusY * Math.cos(angle),
                },
            );
        }

        window.requestAnimationFrame(renderRocket);
    }

    window.requestAnimationFrame(renderRocket);
}

buildStars();
setupRevealObserver();
setupNavigation();
setupRocket();
updateJourney();

window.addEventListener("scroll", queueJourneyUpdate, { passive: true });
window.addEventListener("resize", queueJourneyUpdate);
