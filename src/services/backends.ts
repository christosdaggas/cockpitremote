import { BACKENDS, type BackendDef } from "../constants";
import type { BackendInfo, SessionInfo } from "../types";
import { extractVersion, parseUnitFiles } from "../utils/parse";
import {
    buildListUnitFilesArgs,
    buildVersionArgs,
    buildWhichArgs,
} from "./commands";
import { probe, spawn } from "./spawn";
import { getServiceStatus } from "./systemd";

const UNIT_PATTERNS = ["x11vnc*", "wayvnc*", "vncserver@*", "gnome-remote-desktop*"];

/** Compositors known to implement the wlr screencopy protocol wayvnc needs. */
const WLROOTS_DESKTOPS = ["sway", "hyprland", "wayfire", "river", "labwc", "niri"];

export async function detectBackends(session: SessionInfo): Promise<BackendInfo[]> {
    let unitFiles: string[] = [];
    try {
        unitFiles = parseUnitFiles(
            await spawn(buildListUnitFilesArgs(UNIT_PATTERNS), { superuser: "try" }));
    } catch {
        // systemctl unavailable — leave unit list empty, binary probes still run.
    }
    return Promise.all(BACKENDS.map(def => detectOne(def, unitFiles, session)));
}

async function findBinary(names: string[]): Promise<string | null> {
    for (const name of names) {
        const { ok, output } = await probe(buildWhichArgs(name));
        if (ok && output.trim().startsWith("/"))
            return output.trim().split("\n")[0];
    }
    return null;
}

async function detectOne(def: BackendDef, unitFiles: string[], session: SessionInfo): Promise<BackendInfo> {
    const notes: string[] = [];
    const binaryPath = await findBinary(def.binaries);

    let version: string | null = null;
    if (binaryPath) {
        const binaryName = binaryPath.split("/").pop() ?? def.binaries[0];
        // Version banners often go to stderr (Xvnc) — probe merges the streams.
        const { output } = await probe(buildVersionArgs(binaryName, def.versionFlag));
        version = extractVersion(output);
    }

    // A template unit ("vncserver@.service") is not startable itself; suggest
    // the default instance instead.
    const concrete = unitFiles.find(u => u.startsWith(def.unitPrefix) && !u.includes("@."));
    const template = unitFiles.find(u => u === `${def.unitPrefix}.service` || u.endsWith("@.service"));
    let detectedUnit: string | null = null;
    if (concrete)
        detectedUnit = concrete;
    else if (template && template.startsWith(def.unitPrefix))
        detectedUnit = def.defaultUnit;

    let status = null;
    if (detectedUnit) {
        try {
            status = await getServiceStatus(detectedUnit);
        } catch {
            status = null;
        }
    }

    let supported = def.manageable;
    if (def.id === "grd") {
        supported = false;
        notes.push("Recent GNOME Remote Desktop versions are RDP-only; this plugin cannot connect to it. Shown for information.");
    }
    if (def.id === "x11vnc" && binaryPath && session.type !== "x11")
        notes.push("No active X11 session detected — x11vnc can only mirror a running Xorg session. Consider TigerVNC instead.");
    if (def.id === "wayvnc" && binaryPath) {
        const desktop = (session.desktop ?? "").toLowerCase();
        if (session.type !== "wayland")
            notes.push("No active Wayland session detected.");
        else if (!WLROOTS_DESKTOPS.some(d => desktop.includes(d)))
            notes.push(`The current compositor ("${session.desktop ?? "unknown"}") does not look wlroots-based — wayvnc likely cannot capture it.`);
    }
    if (def.id === "tigervnc" && binaryPath && !detectedUnit)
        notes.push("TigerVNC is installed but no vncserver@ unit was found. See the setup guide below.");

    return {
        id: def.id,
        label: def.label,
        binaryPath,
        version,
        detectedUnit,
        status,
        supported,
        notes,
        defaultPort: def.defaultPort,
    };
}
