/*
 * Translation through Cockpit's own gettext.
 *
 * The catalogues ship beside the bundle as po.<lang>.js, each one a call to
 * cockpit.locale(). cockpit-ws picks the file matching the browser's language
 * when the page asks for "po.js", so nothing here has to detect or load
 * anything. English is the source language and needs no catalogue: gettext
 * hands back the string it was given whenever no translation exists, which is
 * also what makes a partly translated catalogue safe to ship.
 *
 * Translators key off the English source string, so every string passed to _()
 * must be a plain literal — a value assembled at runtime cannot be extracted
 * into a catalogue and would simply never be translated. Where a message needs
 * a value in the middle of it, translate the template and fill it in with
 * format(), so the placeholder can move to wherever the target grammar wants.
 */

import cockpit from "./lib/cockpit";

export function _(text: string): string {
    // The shell provides cockpit.js at runtime; in unit tests it is absent.
    return cockpit?.gettext ? cockpit.gettext(text) : text;
}

/**
 * Marks a literal as translatable where it is written, for the cases where the
 * translation has to happen somewhere else — a table of constants, say, that is
 * built once at load and rendered many times. The catalogue keys off the
 * literal here; the reading side calls _() on the value.
 */
export function N_(text: string): string {
    return text;
}

/** _("Listening on port $0") → format(_("Listening on port $0"), 4822) */
export function format(template: string, ...args: unknown[]): string {
    if (cockpit?.format)
        return cockpit.format(template, ...args);
    return template.replace(/\$(\d+)/g, (match, index) => {
        const value = args[Number(index)];
        return value === undefined ? match : String(value);
    });
}
