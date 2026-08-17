const cubicBezier = {
    point(start, firstControl, secondControl, end, progress) {
        const inverse = 1 - progress;
        return {
            x: inverse ** 3 * start.x
                + 3 * inverse ** 2 * progress * firstControl.x
                + 3 * inverse * progress ** 2 * secondControl.x
                + progress ** 3 * end.x,
            y: inverse ** 3 * start.y
                + 3 * inverse ** 2 * progress * firstControl.y
                + 3 * inverse * progress ** 2 * secondControl.y
                + progress ** 3 * end.y,
        };
    },
    velocity(start, firstControl, secondControl, end, progress) {
        const inverse = 1 - progress;
        return {
            x: 3 * inverse ** 2 * (firstControl.x - start.x)
                + 6 * inverse * progress * (secondControl.x - firstControl.x)
                + 3 * progress ** 2 * (end.x - secondControl.x),
            y: 3 * inverse ** 2 * (firstControl.y - start.y)
                + 6 * inverse * progress * (secondControl.y - firstControl.y)
                + 3 * progress ** 2 * (end.y - secondControl.y),
        };
    },
    acceleration(firstControl, secondControl, end) {
        return {
            x: 6 * (end.x - 2 * secondControl.x + firstControl.x),
            y: 6 * (end.y - 2 * secondControl.y + firstControl.y),
        };
    },
};

const landingCurve = {
    point(start, startVelocity, startAcceleration, end, endVelocity, endAcceleration, duration, progress) {
        const square = progress ** 2;
        const cube = progress ** 3;
        const fourth = progress ** 4;
        const fifth = progress ** 5;
        const durationSquared = duration ** 2;
        const weights = {
            start: 1 - 10 * cube + 15 * fourth - 6 * fifth,
            startVelocity: progress - 6 * cube + 8 * fourth - 3 * fifth,
            startAcceleration: (square - 3 * cube + 3 * fourth - fifth) / 2,
            end: 10 * cube - 15 * fourth + 6 * fifth,
            endVelocity: -4 * cube + 7 * fourth - 3 * fifth,
            endAcceleration: (cube - 2 * fourth + fifth) / 2,
        };

        return {
            x: weights.start * start.x
                + weights.startVelocity * startVelocity.x * duration
                + weights.startAcceleration * startAcceleration.x * durationSquared
                + weights.end * end.x
                + weights.endVelocity * endVelocity.x * duration
                + weights.endAcceleration * endAcceleration.x * durationSquared,
            y: weights.start * start.y
                + weights.startVelocity * startVelocity.y * duration
                + weights.startAcceleration * startAcceleration.y * durationSquared
                + weights.end * end.y
                + weights.endVelocity * endVelocity.y * duration
                + weights.endAcceleration * endAcceleration.y * durationSquared,
        };
    },
    velocity(start, startVelocity, startAcceleration, end, endVelocity, endAcceleration, duration, progress) {
        const square = progress ** 2;
        const cube = progress ** 3;
        const fourth = progress ** 4;
        const durationSquared = duration ** 2;
        const weights = {
            start: -30 * square + 60 * cube - 30 * fourth,
            startVelocity: 1 - 18 * square + 32 * cube - 15 * fourth,
            startAcceleration: (2 * progress - 9 * square + 12 * cube - 5 * fourth) / 2,
            end: 30 * square - 60 * cube + 30 * fourth,
            endVelocity: -12 * square + 28 * cube - 15 * fourth,
            endAcceleration: (3 * square - 8 * cube + 5 * fourth) / 2,
        };

        return {
            x: weights.start * start.x
                + weights.startVelocity * startVelocity.x * duration
                + weights.startAcceleration * startAcceleration.x * durationSquared
                + weights.end * end.x
                + weights.endVelocity * endVelocity.x * duration
                + weights.endAcceleration * endAcceleration.x * durationSquared,
            y: weights.start * start.y
                + weights.startVelocity * startVelocity.y * duration
                + weights.startAcceleration * startAcceleration.y * durationSquared
                + weights.end * end.y
                + weights.endVelocity * endVelocity.y * duration
                + weights.endAcceleration * endAcceleration.y * durationSquared,
        };
    },
};

export function startRocket() {
    const rocket = document.querySelector("[data-rocket]");
    const orbit = rocket?.closest(".rocket-orbit");

    if (!rocket || !orbit) {
        return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const flightTime = 4000;
    const landingTime = 1800;
    const orbitTime = 10000;
    const angularVelocity = Math.PI * 2 / orbitTime;
    let startedAt = 0;

    // the landing curve matches the orbit speed so there is no last second snap
    const render = (time) => {
        startedAt ||= time;

        const elapsed = time - startedAt;
        const geometry = {
            centerX: orbit.clientWidth / 2,
            centerY: orbit.clientHeight / 2,
            radiusX: orbit.clientWidth / 2 - 10,
            radiusY: orbit.clientHeight / 2 - 8,
        };
        let point;
        let velocity;
        let flight;

        if (!reducedMotion && elapsed < flightTime + landingTime) {
            const scaleX = orbit.clientWidth / 368;
            const scaleY = orbit.clientHeight / 224;

            flight = {
                start: { x: -720 * scaleX, y: -250 * scaleY },
                firstControl: { x: -560 * scaleX, y: 390 * scaleY },
                secondControl: { x: -180 * scaleX, y: -360 * scaleY },
                end: { x: 320 * scaleX, y: -170 * scaleY },
            };
        }

        if (reducedMotion) {
            point = { x: geometry.centerX - geometry.radiusX, y: geometry.centerY };
            velocity = { x: 0, y: -geometry.radiusY };
        } else if (elapsed < flightTime) {
            const progress = Math.min(elapsed / flightTime, 1);

            point = cubicBezier.point(flight.start, flight.firstControl, flight.secondControl, flight.end, progress);
            velocity = cubicBezier.velocity(flight.start, flight.firstControl, flight.secondControl, flight.end, progress);
        } else if (elapsed < flightTime + landingTime) {
            const progress = (elapsed - flightTime) / landingTime;
            const flightVelocity = cubicBezier.velocity(flight.start, flight.firstControl, flight.secondControl, flight.end, 1);
            const flightAcceleration = cubicBezier.acceleration(flight.firstControl, flight.secondControl, flight.end);
            const landingEnd = { x: geometry.centerX - geometry.radiusX, y: geometry.centerY };
            const startVelocity = { x: flightVelocity.x / flightTime, y: flightVelocity.y / flightTime };
            const startAcceleration = {
                x: flightAcceleration.x / flightTime ** 2,
                y: flightAcceleration.y / flightTime ** 2,
            };
            const orbitVelocity = { x: 0, y: -geometry.radiusY * angularVelocity };
            const orbitAcceleration = { x: geometry.radiusX * angularVelocity ** 2, y: 0 };

            point = landingCurve.point(
                flight.end, startVelocity, startAcceleration,
                landingEnd, orbitVelocity, orbitAcceleration,
                landingTime, progress,
            );
            velocity = landingCurve.velocity(
                flight.end, startVelocity, startAcceleration,
                landingEnd, orbitVelocity, orbitAcceleration,
                landingTime, progress,
            );
        } else {
            const angle = Math.PI + (elapsed - flightTime - landingTime) * angularVelocity;
            point = {
                x: geometry.centerX + geometry.radiusX * Math.cos(angle),
                y: geometry.centerY + geometry.radiusY * Math.sin(angle),
            };
            velocity = {
                x: -geometry.radiusX * Math.sin(angle),
                y: geometry.radiusY * Math.cos(angle),
            };
        }

        const x = point.x - rocket.offsetWidth / 2;
        const y = point.y - rocket.offsetHeight / 2;
        const angle = Math.atan2(velocity.y, velocity.x) * 180 / Math.PI;

        rocket.style.opacity = reducedMotion ? "1" : `${Math.min(elapsed / 280, 1).toFixed(3)}`;
        rocket.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${angle.toFixed(2)}deg)`;

        if (!reducedMotion) {
            window.requestAnimationFrame(render);
        }
    };

    window.requestAnimationFrame(render);
}
