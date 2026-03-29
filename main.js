const root = document.documentElement;
const starField = document.querySelector("[data-star-field]");
const registerTrigger = document.querySelector("[data-register-trigger]");
const formFeedback = document.querySelector("[data-form-feedback]");
const orbitBodies = [...document.querySelectorAll("[data-orbit-body]")];
const orbitScene = document.querySelector("[data-orbit-scene]");
const pastYearsMenu = document.querySelector("[data-past-years-menu]");
const pastYearsTrigger = document.querySelector("[data-past-years-trigger]");
const pastYearsPanel = document.querySelector("[data-past-years-panel]");

const orbitIntroDuration = 5600;

let orbitFrameId = 0;
let orbitIntroStartTime = 0;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function lerp(start, end, progress) {
    return start + (end - start) * progress;
}

function cubicBezierPoint(start, controlOne, controlTwo, end, progress) {
    const inverse = 1 - progress;
    const inverseSquared = inverse * inverse;
    const progressSquared = progress * progress;

    return {
        x:
            (inverseSquared * inverse * start.x) +
            (3 * inverseSquared * progress * controlOne.x) +
            (3 * inverse * progressSquared * controlTwo.x) +
            (progressSquared * progress * end.x),
        y:
            (inverseSquared * inverse * start.y) +
            (3 * inverseSquared * progress * controlOne.y) +
            (3 * inverse * progressSquared * controlTwo.y) +
            (progressSquared * progress * end.y),
    };
}

function cubicBezierDerivative(start, controlOne, controlTwo, end, progress) {
    const inverse = 1 - progress;

    return {
        x:
            (3 * inverse * inverse * (controlOne.x - start.x)) +
            (6 * inverse * progress * (controlTwo.x - controlOne.x)) +
            (3 * progress * progress * (end.x - controlTwo.x)),
        y:
            (3 * inverse * inverse * (controlOne.y - start.y)) +
            (6 * inverse * progress * (controlTwo.y - controlOne.y)) +
            (3 * progress * progress * (end.y - controlTwo.y)),
    };
}

function angleToVector(angleInDegrees) {
    const angleInRadians = (angleInDegrees * Math.PI) / 180;
    return {
        x: Math.cos(angleInRadians),
        y: Math.sin(angleInRadians),
    };
}

function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function easeInOutCubic(value) {
    if (value < 0.5) {
        return 4 * value * value * value;
    }

    return 1 - (Math.pow(-2 * value + 2, 3) / 2);
}

function updateScrollProgress() {
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
    root.style.setProperty("--scroll-progress", clamp(progress, 0, 1).toFixed(4));
}

function buildStarField() {
    if (!starField) {
        return;
    }

    const starCount = window.innerWidth < 720 ? 90 : 160;

    for (let index = 0; index < starCount; index += 1) {
        const star = document.createElement("span");
        const size = Math.random() * 2.6 + 0.6;

        star.className = "star";
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 76}%`;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.setProperty("--twinkle-duration", `${Math.random() * 4 + 3}s`);
        star.style.setProperty("--twinkle-delay", `${Math.random() * 4}s`);

        if (Math.random() > 0.72) {
            star.style.boxShadow = "0 0 22px rgba(146, 220, 255, 0.4)";
        }

        starField.append(star);
    }
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function openPastYearsMenu() {
    if (!pastYearsMenu || !pastYearsTrigger) {
        return;
    }

    pastYearsMenu.classList.add("is-open");
    pastYearsTrigger.setAttribute("aria-expanded", "true");
}

function closePastYearsMenu() {
    if (!pastYearsMenu || !pastYearsTrigger) {
        return;
    }

    pastYearsMenu.classList.remove("is-open");
    pastYearsTrigger.setAttribute("aria-expanded", "false");
}

function setupPastYearsMenu() {
    if (!pastYearsMenu || !pastYearsTrigger || !pastYearsPanel) {
        return;
    }

    pastYearsMenu.addEventListener("focusin", openPastYearsMenu);
    pastYearsMenu.addEventListener("focusout", (event) => {
        if (!pastYearsMenu.contains(event.relatedTarget)) {
            closePastYearsMenu();
        }
    });
    pastYearsMenu.addEventListener("pointerleave", closePastYearsMenu);

    pastYearsTrigger.addEventListener("click", (event) => {
        event.preventDefault();

        if (pastYearsMenu.classList.contains("is-open")) {
            closePastYearsMenu();
            return;
        }

        openPastYearsMenu();
    });

    [...pastYearsPanel.querySelectorAll("a")].forEach((link) => {
        link.addEventListener("click", closePastYearsMenu);
    });

    document.addEventListener("pointerdown", (event) => {
        if (!pastYearsMenu.contains(event.target)) {
            closePastYearsMenu();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closePastYearsMenu();
        }
    });
}

async function registerInterest() {
    if (!registerTrigger || !formFeedback) {
        return;
    }

    const email = window.prompt("Drop your email and we'll keep you posted.");
    if (email === null) {
        return;
    }

    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
        formFeedback.classList.add("is-error");
        formFeedback.textContent = "That does not look like a valid email.";
        return;
    }

    const defaultLabel = registerTrigger.textContent;
    registerTrigger.setAttribute("disabled", "true");
    registerTrigger.textContent = "Registering...";
    formFeedback.classList.remove("is-error");
    formFeedback.textContent = "Registering...";

    const formData = new FormData();
    formData.append("_subject", "hackPHS 2026 interest list");
    formData.append("_template", "table");
    formData.append("_captcha", "false");
    formData.append("source", "hackPHS 2026 landing page");
    formData.append("email", trimmedEmail);

    try {
        const response = await fetch("https://formsubmit.co/ajax/event@hackphs.tech", {
            method: "POST",
            body: formData,
            headers: {
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            throw new Error("Form request failed");
        }

        formFeedback.textContent = "Registered. We will send updates when more details are out.";
    } catch (error) {
        // if the endpoint flakes, at least leave a fallback
        formFeedback.classList.add("is-error");
        formFeedback.innerHTML =
            'Could not send right now. Email <a href="mailto:event@hackphs.tech">event@hackphs.tech</a> and the team can add you manually.';
    } finally {
        registerTrigger.removeAttribute("disabled");
        registerTrigger.textContent = defaultLabel;
    }
}

function getSceneFocusPoint(scene) {
    if (!scene) {
        return { x: 0, y: 0 };
    }

    const sceneStyle = window.getComputedStyle(scene);
    const focusX = (parseFloat(sceneStyle.getPropertyValue("--space-focus-x")) / 100) * scene.clientWidth;
    const focusY = (parseFloat(sceneStyle.getPropertyValue("--space-focus-y")) / 100) * scene.clientHeight;

    return {
        x: Number.isFinite(focusX) ? focusX : scene.clientWidth * 0.58,
        y: Number.isFinite(focusY) ? focusY : scene.clientHeight * 0.44,
    };
}

function viewportPointToSceneOffset(scene, viewportX, viewportY) {
    const focus = getSceneFocusPoint(scene);
    const sceneRect = scene?.getBoundingClientRect();

    return {
        x: viewportX - ((sceneRect?.left ?? 0) + focus.x),
        y: viewportY - ((sceneRect?.top ?? 0) + focus.y),
    };
}

function getOrbitMetrics(body, time) {
    const scene = body.closest("[data-orbit-scene]");
    const sceneScale = scene
        ? clamp(Math.min(scene.clientWidth / 430, scene.clientHeight / 576), 0.58, 1)
        : 1;
    const radiusX = toNumber(body.dataset.orbitRadiusX, 160) * sceneScale;
    const radiusY = toNumber(body.dataset.orbitRadiusY, 92) * sceneScale;
    const speed = toNumber(body.dataset.orbitSpeed, 0.00035);
    const phase = toNumber(body.dataset.orbitPhase, 0);
    const tilt = (toNumber(body.dataset.orbitTilt, 0) * Math.PI) / 180;

    const orbitAngle = time * speed + phase;
    const localX = Math.cos(orbitAngle) * radiusX;
    const localY = Math.sin(orbitAngle) * radiusY;
    const cosTilt = Math.cos(tilt);
    const sinTilt = Math.sin(tilt);
    const sceneX = localX * cosTilt - localY * sinTilt;
    const sceneY = localX * sinTilt + localY * cosTilt;
    const tangentX = -Math.sin(orbitAngle) * radiusX * cosTilt - Math.cos(orbitAngle) * radiusY * sinTilt;
    const tangentY = -Math.sin(orbitAngle) * radiusX * sinTilt + Math.cos(orbitAngle) * radiusY * cosTilt;
    const rotation = (Math.atan2(tangentY, tangentX) * 180) / Math.PI;
    const depth = (Math.sin(orbitAngle) + 1) / 2;
    const scale = 0.74 + depth * 0.34;

    return {
        x: sceneX,
        y: sceneY,
        rotation,
        depth,
        scale,
        isIntro: false,
    };
}

function setOrbitVisual(body, metrics) {
    body.style.setProperty("--orbit-x", `${metrics.x.toFixed(2)}px`);
    body.style.setProperty("--orbit-y", `${metrics.y.toFixed(2)}px`);
    body.style.setProperty("--orbit-rotation", `${metrics.rotation.toFixed(2)}deg`);
    body.style.setProperty("--orbit-scale", metrics.scale.toFixed(3));
    body.classList.toggle("is-front", metrics.depth >= 0.5);
    body.classList.toggle("is-back", metrics.depth < 0.5);
    body.classList.toggle("is-intro-flight", Boolean(metrics.isIntro));

    const glow = body.querySelector("[data-orbit-shadow]");
    if (glow) {
        const baseGlow = metrics.isIntro ? 0.24 : 0.14;
        const glowRange = metrics.isIntro ? 0.34 : 0.24;
        glow.style.opacity = `${(baseGlow + metrics.depth * glowRange).toFixed(3)}`;
    }
}

function getRocketChaosMetrics(body, progress) {
    const scene = body.closest("[data-orbit-scene]");
    const viewportWidth = window.innerWidth || 1280;
    const viewportHeight = window.innerHeight || 720;
    const sceneRect = scene?.getBoundingClientRect();
    const sweepStartX = -220;
    const sweepEndX = viewportWidth + 220;
    const baseX = lerp(sweepStartX, sweepEndX, progress);
    const baseY = lerp(viewportHeight * 0.2, viewportHeight * 0.44, progress);
    const waveX =
        (Math.sin(progress * 24.6) * viewportWidth * 0.16) +
        (Math.cos((progress * 11.4) + 0.8) * viewportWidth * 0.08);
    const waveY =
        (Math.cos((progress * 18.2) + 0.35) * viewportHeight * 0.2) +
        (Math.sin((progress * 12.6) + 2.4) * viewportHeight * 0.12) +
        (Math.sin((progress * 6.2) + 0.6) * viewportHeight * 0.06);

    const viewportX = baseX + waveX;
    const viewportY = baseY + waveY + Math.min(sceneRect?.top ?? 0, viewportHeight * 0.12);

    const nextProgress = clamp(progress + 0.0025, 0, 1);
    const nextBaseX = lerp(sweepStartX, sweepEndX, nextProgress);
    const nextBaseY = lerp(viewportHeight * 0.2, viewportHeight * 0.44, nextProgress);
    const nextWaveX =
        (Math.sin(nextProgress * 24.6) * viewportWidth * 0.16) +
        (Math.cos((nextProgress * 11.4) + 0.8) * viewportWidth * 0.08);
    const nextWaveY =
        (Math.cos((nextProgress * 18.2) + 0.35) * viewportHeight * 0.2) +
        (Math.sin((nextProgress * 12.6) + 2.4) * viewportHeight * 0.12) +
        (Math.sin((nextProgress * 6.2) + 0.6) * viewportHeight * 0.06);
    const nextViewportX = nextBaseX + nextWaveX;
    const nextViewportY = nextBaseY + nextWaveY + Math.min(sceneRect?.top ?? 0, viewportHeight * 0.12);

    const scenePoint = viewportPointToSceneOffset(scene, viewportX, viewportY);
    const nextScenePoint = viewportPointToSceneOffset(scene, nextViewportX, nextViewportY);

    const depth = clamp(0.48 + (Math.sin(progress * 9.4) * 0.32), 0.08, 0.96);

    return {
        x: scenePoint.x,
        y: scenePoint.y,
        rotation: (Math.atan2(nextScenePoint.y - scenePoint.y, nextScenePoint.x - scenePoint.x) * 180) / Math.PI,
        depth,
        scale: 0.82 + (depth * 0.22),
        isIntro: true,
    };
}

function getRocketApproachCurve(scene, startMetrics, targetMetrics) {
    const sceneScale = scene
        ? clamp(Math.min(scene.clientWidth / 430, scene.clientHeight / 576), 0.58, 1)
        : 1;
    const startDirection = angleToVector(startMetrics.rotation);
    const endDirection = angleToVector(targetMetrics.rotation);
    const startPull = 132 * sceneScale;
    const endPull = 112 * sceneScale;

    return {
        start: { x: startMetrics.x, y: startMetrics.y },
        controlOne: {
            x: startMetrics.x + (startDirection.x * startPull),
            y: startMetrics.y + (startDirection.y * startPull),
        },
        controlTwo: {
            x: targetMetrics.x - (endDirection.x * endPull),
            y: targetMetrics.y - (endDirection.y * endPull),
        },
        end: { x: targetMetrics.x, y: targetMetrics.y },
    };
}

function getRocketApproachPoint(scene, startMetrics, targetMetrics, progress) {
    const eased = easeInOutCubic(progress);
    const curve = getRocketApproachCurve(scene, startMetrics, targetMetrics);
    return cubicBezierPoint(curve.start, curve.controlOne, curve.controlTwo, curve.end, eased);
}

function getRocketApproachMetrics(body, time, progress) {
    const scene = body.closest("[data-orbit-scene]");
    const targetMetrics = getOrbitMetrics(body, time);
    const startMetrics = getRocketChaosMetrics(body, 1);
    const point = getRocketApproachPoint(scene, startMetrics, targetMetrics, progress);
    const eased = easeInOutCubic(progress);
    const curve = getRocketApproachCurve(scene, startMetrics, targetMetrics);
    const tangent = cubicBezierDerivative(curve.start, curve.controlOne, curve.controlTwo, curve.end, eased);

    return {
        x: point.x,
        y: point.y,
        rotation: (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI,
        depth: lerp(0.42, targetMetrics.depth, eased),
        scale: lerp(startMetrics.scale, targetMetrics.scale, eased),
        isIntro: true,
    };
}

function getRocketIntroMetrics(body, time) {
    const elapsed = time - orbitIntroStartTime;
    const chaosDuration = orbitIntroDuration * 0.66;

    if (elapsed <= chaosDuration) {
        return getRocketChaosMetrics(body, clamp(elapsed / chaosDuration, 0, 1));
    }

    const approachProgress = clamp((elapsed - chaosDuration) / (orbitIntroDuration - chaosDuration), 0, 1);
    return getRocketApproachMetrics(body, time, approachProgress);
}

function updateOrbitBody(body, time, introActive) {
    const isRocket = body.classList.contains("orbit-body--rocket");
    const metrics = (isRocket && introActive) ? getRocketIntroMetrics(body, time) : getOrbitMetrics(body, time);
    setOrbitVisual(body, metrics);
}

function runOrbitScene(time) {
    if (!orbitIntroStartTime) {
        orbitIntroStartTime = time;
    }

    const introActive = (time - orbitIntroStartTime) < orbitIntroDuration;
    orbitScene?.classList.toggle("is-rocket-intro", introActive);
    orbitScene?.classList.toggle("is-orbit-live", !introActive);
    orbitBodies.forEach((body) => updateOrbitBody(body, time, introActive));
    orbitFrameId = window.requestAnimationFrame(runOrbitScene);
}

function startOrbitScene() {
    if (!orbitBodies.length) {
        return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
        orbitScene?.classList.add("is-orbit-live");
        orbitScene?.classList.remove("is-rocket-intro");
        orbitBodies.forEach((body) => updateOrbitBody(body, 1800, false));
        return;
    }

    if (orbitFrameId) {
        window.cancelAnimationFrame(orbitFrameId);
    }

    orbitIntroStartTime = 0;
    orbitFrameId = window.requestAnimationFrame(runOrbitScene);
}

buildStarField();
updateScrollProgress();
startOrbitScene();
setupPastYearsMenu();

registerTrigger?.addEventListener("click", registerInterest);
window.addEventListener("scroll", updateScrollProgress, { passive: true });
window.addEventListener("resize", updateScrollProgress);
