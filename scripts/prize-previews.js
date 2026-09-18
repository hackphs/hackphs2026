export function startPrizePreviews() {
    document.querySelectorAll("[data-prize-preview]").forEach((preview) => {
        let drag = null;
        let moved = false;
        let tiltX = 0;
        let tiltY = 0;

        // these are photos so a little tilt works better than a full spin
        const render = () => {
            tiltX = Math.max(-18, Math.min(18, tiltX));
            tiltY = Math.max(-28, Math.min(28, tiltY));
            preview.style.setProperty("--tilt-x", `${tiltX}deg`);
            preview.style.setProperty("--tilt-y", `${tiltY}deg`);
        };

        preview.disabled = false;
        preview.addEventListener("pointerdown", (event) => {
            if (!event.isPrimary || event.button !== 0) return;
            moved = false;
            drag = { x: event.clientX, y: event.clientY, tiltX, tiltY };
            preview.setPointerCapture(event.pointerId);
            preview.classList.add("is-dragging");
        });

        preview.addEventListener("pointermove", (event) => {
            if (!drag) return;
            const dx = event.clientX - drag.x;
            const dy = event.clientY - drag.y;
            moved ||= Math.abs(dx) + Math.abs(dy) > 4;
            tiltY = drag.tiltY + dx * 0.16;
            tiltX = drag.tiltX - dy * 0.12;
            render();
        });

        preview.addEventListener("lostpointercapture", () => {
            drag = null;
            preview.classList.remove("is-dragging");
        });

        preview.addEventListener("click", (event) => {
            if (moved && event.detail > 0) return;
            tiltX = tiltY = 0;
            render();
        });

        // arrow keys offer the same interaction without needing a mouse
        preview.addEventListener("keydown", (event) => {
            switch (event.key) {
                case "ArrowLeft": tiltY -= 6; break;
                case "ArrowRight": tiltY += 6; break;
                case "ArrowUp": tiltX += 6; break;
                case "ArrowDown": tiltX -= 6; break;
                case "Home":
                case "Escape": tiltX = tiltY = 0; break;
                default: return;
            }
            event.preventDefault();
            render();
        });
    });
}
