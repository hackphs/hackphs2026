export function startRegistration() {
    const bar = document.querySelector("[data-registration-bar]");
    const hero = document.querySelector(".hero-section");
    if (!bar || !hero) return;

    // show event updates once the hero scrolls away
    const observer = new IntersectionObserver(([entry]) => {
        const visible = entry.boundingClientRect.bottom <= 0;
        bar.classList.toggle("is-visible", visible);
        bar.inert = !visible;
        bar.setAttribute("aria-hidden", String(!visible));
    });
    observer.observe(hero);
}
