/*
 * GNOME Remote Desktop's VNC screen-share mode. grdctl has no subcommand for
 * it, so it is read and written through GSettings — as the Cockpit user, the
 * same one whose GNOME session and user unit the rest of the plugin manages.
 */

import type { GrdVncScreenShareMode } from "../types";
import { parseGsettingsValue } from "../utils/parse";
import { buildVncScreenShareModeGetArgs, buildVncScreenShareModeSetArgs } from "./commands";
import { probe, spawn } from "./spawn";

/**
 * Null rather than a default when the value cannot be read: RDP-only builds
 * ship no VNC schema at all, and guessing one would make the UI offer a
 * setting that does not exist.
 */
export async function getVncScreenShareMode(): Promise<GrdVncScreenShareMode | null> {
    // err:"message" keeps GLib's warnings out of the value being parsed.
    const { ok, output } = await probe(buildVncScreenShareModeGetArgs(), { err: "message" });
    if (!ok)
        return null;
    const value = parseGsettingsValue(output);
    return value === "mirror-primary" || value === "extend" ? value : null;
}

/**
 * The daemon reads this when a session starts, so a change applies to the next
 * connection. Deliberately no service restart: it would drop whatever session
 * is running, quite possibly the one the user is sitting in.
 */
export async function setVncScreenShareMode(mode: GrdVncScreenShareMode): Promise<void> {
    await spawn(buildVncScreenShareModeSetArgs(mode));
    /*
     * gsettings still exits 0 when dconf cannot reach the user's session bus:
     * it drops the write and only prints a warning. Reading the value back is
     * the sole reliable way to tell a stored setting from a lost one.
     */
    if (await getVncScreenShareMode() !== mode)
        throw new Error(
            "GNOME did not store the new setting. Its configuration is only writable from a " +
            "session of the same user that owns the desktop — check that you are logged into " +
            "Cockpit as that user, or run \"gsettings set org.gnome.desktop.remote-desktop.vnc " +
            `screen-share-mode '${mode}'" on the host.`);
}
