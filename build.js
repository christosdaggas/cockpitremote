// esbuild driver for the cockpitremote Cockpit package.
// Produces dist/ = the installable Cockpit package (index.html, manifest.json,
// index.js, index.css). cockpit.js is NOT bundled — Cockpit's shell provides it
// at runtime via <script src="../base1/cockpit.js"> in index.html.
import fs from "node:fs";
import esbuild from "esbuild";

const production = process.env.NODE_ENV === "production";
const watch = process.argv.includes("--watch");

/*
 * Translation catalogues. Each po/<lang>.json maps an English source string to
 * its translation; this emits the po.<lang>.js that Cockpit expects, a single
 * cockpit.locale() call in the same shape the rest of the Cockpit packages
 * ship. cockpit-ws negotiates which one it serves for "po.js" using the
 * browser's Accept-Language, so nothing in the bundle chooses a language.
 *
 * Empty translations are dropped rather than emitted: gettext falls back to
 * the source string when a key is missing, but an empty one would blank the
 * text on screen.
 */
const LANGUAGE_DIRECTION = "ltr";

function buildCatalogues() {
    if (!fs.existsSync("po"))
        return [];
    const written = [];
    for (const file of fs.readdirSync("po").filter(name => name.endsWith(".json"))) {
        const language = file.replace(/\.json$/, "");
        const entries = JSON.parse(fs.readFileSync(`po/${file}`, "utf8"));
        const catalogue = {
            "": {
                language,
                "language-direction": LANGUAGE_DIRECTION,
            },
        };
        let count = 0;
        for (const [source, translation] of Object.entries(entries)) {
            if (typeof translation !== "string" || translation === "")
                continue;
            catalogue[source] = [null, translation];
            count++;
        }
        fs.writeFileSync(`dist/po.${language}.js`,
                         `cockpit.locale(${JSON.stringify(catalogue, null, 1)});\n`);
        written.push(`${language} (${count})`);
    }
    return written;
}

const copyStatic = {
    name: "copy-static",
    setup(build) {
        build.onEnd(result => {
            if (result.errors.length > 0)
                return;
            fs.mkdirSync("dist", { recursive: true });
            fs.copyFileSync("src/index.html", "dist/index.html");
            fs.copyFileSync("src/manifest.json", "dist/manifest.json");
            const catalogues = buildCatalogues();
            // eslint-disable-next-line no-console
            console.log(`[${new Date().toLocaleTimeString()}] build finished` +
                        (catalogues.length ? ` — translations: ${catalogues.join(", ")}` : ""));
        });
    },
};

const config = {
    entryPoints: ["src/index.tsx"],
    outdir: "dist",
    entryNames: "index",
    bundle: true,
    format: "iife",
    target: ["es2020"],
    jsx: "automatic",
    minify: production,
    sourcemap: production ? false : "linked",
    legalComments: "linked",
    loader: {
        // Cockpit's shell already ships the Red Hat fonts PatternFly wants,
        // so font files referenced by PatternFly CSS are dropped from the bundle.
        ".woff": "empty",
        ".woff2": "empty",
        ".ttf": "empty",
        ".eot": "empty",
        ".svg": "dataurl",
        ".png": "dataurl",
        ".jpg": "dataurl",
        ".gif": "dataurl",
    },
    plugins: [copyStatic],
};

if (watch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    // eslint-disable-next-line no-console
    console.log("watching for changes...");
} else {
    await esbuild.build(config);
}
