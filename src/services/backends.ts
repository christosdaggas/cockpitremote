import { BACKENDS, type BackendDef } from "../constants";
import type { BackendInfo, SessionInfo } from "../types";
import { extractVersion, parseGrdStatus, parseUnitFiles } from "../utils/parse";
import {
    buildGrdctlStatusArgs,
    buildListUnitFilesArgs,
    buildVersionArgs,
    buildWhichArgs,
} from "./commands";
import { probe, spawn } from "./spawn";
import { getServiceStatus } from "./systemd";

/*
 * GNOME Remote Desktop's session daemon is a user unit. A system unit of the
 * same name also exists (the RDP-only headless daemon) — that one is NOT the
 * VNC server this plugin talks to, so grd is detected in user scope only.
 */
const USER_UNIT_PATTERNS = ["gnome-remote-desktop*"];

export async function detectBackends(session: SessionInfo): Promise<BackendInfo[]> {
    void session;
    const userUnits = await listUnitFiles(USER_UNIT_PATTERNS, "user");
    return Promise.all(BACKENDS.map(def =>
        detectOne(def, userUnits)));
}

async function listUnitFiles(patterns: string[], scope: "system" | "user"): Promise<string[]> {
    try {
        return parseUnitFiles(await spawn(
            buildListUnitFilesArgs(patterns, scope),
            scope === "system" ? { superuser: "try" } : {}));
    } catch {
        // systemctl (or the user manager) unavailable — binary probes still run.
        return [];
    }
}

async function findBinary(names: string[]): Promise<string | null> {
    for (const name of names) {
        const { ok, output } = await probe(buildWhichArgs(name));
        if (ok && output.trim().startsWith("/"))
            return output.trim().split("\n")[0];
    }
    return null;
}

async function detectOne(def: BackendDef, unitFiles: string[]): Promise<BackendInfo> {
    const notes: string[] = [];
    const binaryPath = await findBinary(def.binaries);

    let version: string | null = null;
    if (binaryPath) {
        const binaryName = binaryPath.split("/").pop() ?? def.binaries[0];
        // Some version banners go to stderr — probe merges the streams.
        const { output } = await probe(buildVersionArgs(binaryName, def.versionFlag));
        version = extractVersion(output);
    }

    // Prefer the exact default unit ("gnome-remote-desktop.service" must not
    // lose to its "-headless"/"-handover" siblings), then any concrete unit.
    const exact = unitFiles.find(u => u === def.defaultUnit);
    const concrete = unitFiles.find(u => u.startsWith(def.unitPrefix) && !u.includes("@."));
    const template = unitFiles.find(u => u === `${def.unitPrefix}.service` || u.endsWith("@.service"));
    let detectedUnit: string | null = null;
    if (exact)
        detectedUnit = exact;
    else if (concrete)
        detectedUnit = concrete;
    else if (template && template.startsWith(def.unitPrefix))
        detectedUnit = def.defaultUnit;

    let status = null;
    if (detectedUnit) {
        try {
            status = await getServiceStatus(detectedUnit, def.unitScope);
        } catch {
            status = null;
        }
    }

    let supported = def.manageable;
    let detectedPort: number | null = null;
    if ((def.id === "grd" || def.id === "grd-rdp") && binaryPath) {
        // stderr must stay out of the parsed stream (err:"message" overrides
        // probe's err:"out"): grdctl mixes GLib warnings into the output.
        const { ok, output } = await probe(buildGrdctlStatusArgs(), { err: "message" });
        if (!ok || !/^Overall:/m.test(output)) {
            // Failed or unrecognizable output is NOT proof of an RDP-only build.
            supported = false;
            notes.push("Could not read GNOME Remote Desktop's status (\"grdctl status\" failed), " +
                "so endpoint capability is unknown. Refresh to retry.");
        } else {
            const grd = parseGrdStatus(output);
            if (def.id === "grd-rdp") {
                if (!grd.hasRdp) {
                    supported = false;
                    notes.push("This GNOME Remote Desktop build provides no RDP backend.");
                } else {
                    detectedPort = grd.rdpPort;
                    notes.push("Runs in the logged-in user's GNOME session and uses the standard RDP protocol.");
                    notes.push("The browser console uses local guacd as the RDP gateway.");
                    if (!grd.rdpEnabled)
                        notes.push("RDP is currently disabled. Enable it with GNOME Settings or grdctl.");
                    if (grd.rdpViewOnly)
                        notes.push("View-only mode is on, so remote input is ignored.");
                    if (grd.rdpPasswordEmpty)
                        notes.push("RDP password authentication is selected but no password is stored.");
                }
            } else if (!grd.hasVnc) {
                supported = false;
                notes.push("This GNOME Remote Desktop build provides no VNC backend (recent upstream " +
                    "versions are RDP-only) — the console cannot connect to it.");
            } else {
                detectedPort = grd.vncPort;
                notes.push("Runs in the logged-in user's session — service control and settings apply " +
                    "to the user you are logged into Cockpit as.");
                notes.push("Its VNC server listens on all network interfaces and cannot be limited to " +
                    "127.0.0.1. The console tunnels through Cockpit either way — consider blocking " +
                    "outside access to the VNC port with a firewall rule.");
                if (!grd.vncEnabled)
                    notes.push("VNC is currently disabled. Enable it with \"grdctl vnc enable\" as the " +
                        "desktop user, or in GNOME Settings under Remote Desktop.");
                if (grd.vncViewOnly)
                    notes.push("View-only mode is on, so remote input is ignored. Allow control with " +
                        "\"grdctl vnc disable-view-only\".");
                if (grd.vncAuthMethod === "prompt")
                    notes.push("Authentication is set to \"prompt\": each connection must be approved " +
                        "on the host's desktop. For unattended access run \"grdctl vnc set-auth-method " +
                        "password\" and \"grdctl vnc set-password\".");
                else if (grd.vncAuthMethod === "password" && grd.vncPasswordEmpty)
                    notes.push("Password authentication is selected but no password is stored — " +
                        "connections will fail until one is set with \"grdctl vnc set-password\".");
            }
        }
    }
    return {
        id: def.id,
        label: def.label,
        protocol: def.protocol,
        binaryPath,
        version,
        detectedUnit,
        unitScope: def.unitScope,
        status,
        supported,
        notes,
        defaultPort: def.defaultPort,
        detectedPort,
    };
}
