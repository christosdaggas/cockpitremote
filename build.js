// esbuild driver for the cockpitremote Cockpit package.
// Produces dist/ = the installable Cockpit package (index.html, manifest.json,
// index.js, index.css). cockpit.js is NOT bundled — Cockpit's shell provides it
// at runtime via <script src="../base1/cockpit.js"> in index.html.
import fs from "node:fs";
import esbuild from "esbuild";

const production = process.env.NODE_ENV === "production";
const watch = process.argv.includes("--watch");

const copyStatic = {
    name: "copy-static",
    setup(build) {
        build.onEnd(result => {
            if (result.errors.length > 0)
                return;
            fs.mkdirSync("dist", { recursive: true });
            fs.copyFileSync("src/index.html", "dist/index.html");
            fs.copyFileSync("src/manifest.json", "dist/manifest.json");
            // eslint-disable-next-line no-console
            console.log(`[${new Date().toLocaleTimeString()}] build finished`);
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
