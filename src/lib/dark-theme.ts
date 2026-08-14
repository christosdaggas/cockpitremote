// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

/*
 * Keeps PatternFly's dark-theme class on <html> in sync with the Cockpit
 * shell's appearance setting, like cockpit's own pkg/lib/cockpit-dark-theme.js:
 * the shell persists the choice in localStorage ("shell:style") and notifies
 * open frames with a "cockpit-style" window event; "auto" follows the
 * browser's prefers-color-scheme.
 */

function setDarkMode(style?: string) {
    const preference = style ?? localStorage.getItem("shell:style") ?? "auto";
    const dark = preference === "dark" ||
        (preference === "auto" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("pf-v6-theme-dark", dark);
}

window.addEventListener("storage", event => {
    if (event.key === "shell:style")
        setDarkMode();
});

window.addEventListener("cockpit-style", event => {
    setDarkMode((event as CustomEvent<{ style?: string }>).detail?.style);
});

window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => setDarkMode());

setDarkMode();
