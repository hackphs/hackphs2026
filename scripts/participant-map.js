export function startParticipantMap() {
    const map = document.querySelector("[data-participant-map]");
    if (!map) return;
    const viewport = map.querySelector("[data-map-viewport]");
    const image = map.querySelector("[data-map-image]");
    const output = map.querySelector("[data-map-zoom]");
    const pointers = new Map();
    let scale = 1, x = 0, y = 0, gesture;
    const paint = () => {
        const bounds = viewport.getBoundingClientRect();
        x = Math.max(-bounds.width * (scale - 1) / 2, Math.min(bounds.width * (scale - 1) / 2, x));
        y = Math.max(-bounds.height * (scale - 1) / 2, Math.min(bounds.height * (scale - 1) / 2, y));
        image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        output.textContent = `${Math.round(scale * 100)}%`;
        map.querySelector('[data-map-action="out"]').disabled = scale <= 1;
        map.querySelector('[data-map-action="in"]').disabled = scale >= 4;
    };
    const zoom = (next, clientX, clientY) => {
        const bounds = viewport.getBoundingClientRect();
        const ax = clientX === undefined ? 0 : clientX - bounds.left - bounds.width / 2;
        const ay = clientY === undefined ? 0 : clientY - bounds.top - bounds.height / 2;
        next = Math.max(1, Math.min(4, next));
        x = ax - (ax - x) * next / scale;
        y = ay - (ay - y) * next / scale;
        scale = next;
        paint();
    };
    const reset = () => { scale = 1; x = y = 0; paint(); };
    const beginGesture = () => {
        const points = [...pointers.values()];
        if (points.length === 2) {
            gesture = { x, y, scale, midX: (points[0].x + points[1].x) / 2,
                midY: (points[0].y + points[1].y) / 2,
                distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) };
        } else if (points.length === 1) gesture = { x, y, point: points[0] };
        else gesture = null;
    };
    viewport.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || pointers.size >= 2) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        viewport.setPointerCapture(event.pointerId);
        viewport.classList.add("is-dragging");
        beginGesture();
    });
    viewport.addEventListener("pointermove", (event) => {
        if (!pointers.has(event.pointerId) || !gesture) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const points = [...pointers.values()];
        if (points.length === 2 && gesture.distance > 0) {
            const bounds = viewport.getBoundingClientRect();
            const next = Math.max(1, Math.min(4, gesture.scale * Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) / gesture.distance));
            const ax = gesture.midX - bounds.left - bounds.width / 2;
            const ay = gesture.midY - bounds.top - bounds.height / 2;
            x = (points[0].x + points[1].x) / 2 - bounds.left - bounds.width / 2 - (ax - gesture.x) * next / gesture.scale;
            y = (points[0].y + points[1].y) / 2 - bounds.top - bounds.height / 2 - (ay - gesture.y) * next / gesture.scale;
            scale = next;
        } else if (gesture.point) {
            x = gesture.x + event.clientX - gesture.point.x;
            y = gesture.y + event.clientY - gesture.point.y;
        }
        paint();
    });
    const end = (event) => {
        pointers.delete(event.pointerId);
        if (!pointers.size) viewport.classList.remove("is-dragging");
        beginGesture();
    };
    viewport.addEventListener("pointerup", end);
    viewport.addEventListener("pointercancel", end);
    viewport.addEventListener("lostpointercapture", end);
    viewport.addEventListener("wheel", (event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        zoom(scale * Math.exp(-event.deltaY * .005), event.clientX, event.clientY);
    }, { passive: false });
    viewport.addEventListener("keydown", (event) => {
        if (["+", "=", "-", "Home", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) event.preventDefault();
        if (event.key === "+" || event.key === "=") zoom(scale * 1.25);
        if (event.key === "-") zoom(scale / 1.25);
        if (event.key === "Home") reset();
        if (event.key === "ArrowLeft") x += 50;
        if (event.key === "ArrowRight") x -= 50;
        if (event.key === "ArrowUp") y += 50;
        if (event.key === "ArrowDown") y -= 50;
        paint();
    });
    map.querySelectorAll("[data-map-action]").forEach((button) => button.addEventListener("click", async () => {
        switch (button.dataset.mapAction) {
            case "in": zoom(scale * 1.25); break;
            case "out": zoom(scale / 1.25); break;
            case "reset": reset(); break;
            case "fullscreen":
                try {
                    if (document.fullscreenElement === map) await document.exitFullscreen();
                    else if (map.requestFullscreen) await map.requestFullscreen();
                    else map.classList.toggle("is-expanded");
                } catch { map.classList.toggle("is-expanded"); }
                break;
        }
    }));
    const fullscreenButton = map.querySelector('[data-map-action="fullscreen"]');
    const updateExpanded = () => {
        const expanded = document.fullscreenElement === map || map.classList.contains("is-expanded");
        fullscreenButton.textContent = expanded ? "Exit full screen" : "Full screen";
        fullscreenButton.setAttribute("aria-pressed", String(expanded));
        paint();
    };
    new MutationObserver(updateExpanded).observe(map, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("fullscreenchange", updateExpanded);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") map.classList.remove("is-expanded"); });
    new ResizeObserver(paint).observe(viewport);
    map.classList.add("is-interactive");
    paint();
}
