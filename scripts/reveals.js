export function startReveals() {
    const items = [...document.querySelectorAll(".reveal")];

    // elements only need their entrance animation once
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        });
    }, {
        rootMargin: "0px 0px -12%",
        threshold: 0.12,
    });

    items.forEach((item) => observer.observe(item));
}
