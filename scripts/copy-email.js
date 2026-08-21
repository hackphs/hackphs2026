const emailAddress = "team@hackphs.tech";

export function startCopyEmail() {
    const emailLinks = document.querySelectorAll(`a[href="mailto:${emailAddress}"]`);

    if (!emailLinks.length) {
        return;
    }

    const status = document.createElement("span");
    let activeLink;
    let resetTimer;

    status.className = "visually-hidden";
    status.setAttribute("aria-live", "polite");
    document.body.append(status);

    for (const link of emailLinks) {
        link.classList.add("copy-email");
        link.title = "Copy email address";

        link.addEventListener("click", async (event) => {
            event.preventDefault();

            let copied = false;

            try {
                await navigator.clipboard.writeText(emailAddress);
                copied = true;
            } catch {
                // keep copying available in browsers without clipboard access
                const textArea = document.createElement("textarea");
                textArea.value = emailAddress;
                textArea.setAttribute("readonly", "");
                textArea.style.position = "fixed";
                textArea.style.opacity = "0";
                document.body.append(textArea);
                textArea.select();
                copied = document.execCommand("copy");
                textArea.remove();
            }

            activeLink?.classList.remove("is-copied", "copy-email--failed");
            window.clearTimeout(resetTimer);

            activeLink = link;
            link.dataset.copyMessage = copied ? "Copied!" : "Couldn’t copy";
            link.classList.add(copied ? "is-copied" : "copy-email--failed");
            status.textContent = copied ? `Copied ${emailAddress}` : "Could not copy the email address";

            resetTimer = window.setTimeout(() => {
                link.classList.remove("is-copied", "copy-email--failed");
                activeLink = undefined;
            }, 1800);
        });
    }
}
