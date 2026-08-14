import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Translations are keyed by the English source string, so a catalogue silently
 * rots the moment a string is reworded: gettext finds no entry and falls back
 * to English, with nothing to show for it. These checks read the sources the
 * way a catalogue does and fail when the two drift apart.
 */

const SOURCE_ROOT = join(__dirname, "..", "src");
const PO_ROOT = join(__dirname, "..", "po");

/** Matches _("literal") and N_("literal"), the only two marking forms. */
const MARKER = /\b_\(\s*"((?:[^"\\]|\\.)*)"\s*\)|\bN_\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g;

function sourceFiles(dir: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory())
            found.push(...sourceFiles(path));
        // i18n.ts defines the markers; its own examples are not UI strings.
        else if (/\.tsx?$/.test(entry.name) && entry.name !== "i18n.ts")
            found.push(path);
    }
    return found;
}

function extractMsgids(): string[] {
    const seen = new Set<string>();
    for (const file of sourceFiles(SOURCE_ROOT)) {
        const text = readFileSync(file, "utf8");
        for (const match of text.matchAll(MARKER)) {
            const raw = match[1] ?? match[2];
            seen.add(raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/\\n/g, "\n"));
        }
    }
    return [...seen];
}

type Catalogue = [name: string, entries: Record<string, string>];

function catalogues(): Catalogue[] {
    return readdirSync(PO_ROOT)
        .filter(name => name.endsWith(".json"))
        .map(name => [name, JSON.parse(readFileSync(join(PO_ROOT, name), "utf8"))] as Catalogue);
}

const msgids = extractMsgids();
const languages = catalogues();

describe("translation catalogues", () => {
    it("finds the strings marked in the sources", () => {
        expect(msgids.length).toBeGreaterThan(100);
    });

    it("ships at least the languages the package promises", () => {
        expect(languages.map(([name]) => name).sort())
            .toEqual(["de.json", "el.json", "fr.json", "it.json", "pt.json"]);
    });

    it.each(languages)("%s translates every marked string", (_name, entries) => {
        expect(msgids.filter(id => !(id in entries))).toEqual([]);
    });

    /*
     * A key no longer in the sources is dead weight, and usually the leftover
     * of a reworded string whose new wording nobody translated.
     */
    it.each(languages)("%s has no entries the sources no longer use", (_name, entries) => {
        expect(Object.keys(entries).filter(key => !msgids.includes(key))).toEqual([]);
    });

    /*
     * An empty translation would blank the text on screen; leaving the key out
     * entirely is what falls back to English.
     */
    it.each(languages)("%s has no empty translations", (_name, entries) => {
        expect(Object.entries(entries).filter(([, value]) => value.trim() === "")).toEqual([]);
    });

    /*
     * format() fills $0/$1 after translation, so a placeholder dropped by a
     * translator loses the port number, user name or unit it was carrying.
     */
    it.each(languages)("%s keeps every placeholder", (_name, entries) => {
        const lost = Object.entries(entries).flatMap(([source, translation]) =>
            ["$0", "$1"]
                .filter(placeholder => source.includes(placeholder) && !translation.includes(placeholder))
                .map(placeholder => `${placeholder} in "${source}"`));
        expect(lost).toEqual([]);
    });
});
