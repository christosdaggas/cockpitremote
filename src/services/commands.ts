/*
 * The ONLY place where command argument arrays are assembled. Every builder
 * validates its inputs (utils/validation.ts) and returns a plain argv array —
 * cockpit.spawn() is never called with shell interpolation anywhere in this
 * codebase, so nothing here can be turned into shell injection.
 */

import type { GrdVncScreenShareMode, SystemdAction, UnitScope } from "../types";
import {
    ValidationError,
    validateBinaryName,
    validatePath,
    validatePort,
    validateSessionId,
    validateUnitName,
    validateUsername,
} from "../utils/validation";
import { LOG_LINE_CHOICES } from "../constants";

const SYSTEMD_ACTIONS: readonly SystemdAction[] = ["start", "stop", "restart", "enable", "disable"];

/** "--user" targets the caller's session manager (GNOME Remote Desktop). */
function systemctlBase(scope: UnitScope): string[] {
    return scope === "user" ? ["systemctl", "--user"] : ["systemctl"];
}

export function buildSystemctlActionArgs(action: SystemdAction, unit: string, scope: UnitScope = "system"): string[] {
    if (!SYSTEMD_ACTIONS.includes(action))
        throw new ValidationError(`Unsupported systemd action: ${JSON.stringify(action)}.`);
    return [...systemctlBase(scope), action, validateUnitName(unit)];
}

export function buildSystemctlEnableNowArgs(unit: string): string[] {
    return ["systemctl", "enable", "--now", validateUnitName(unit)];
}

export function buildSystemctlShowArgs(unit: string, scope: UnitScope = "system"): string[] {
    return [
        ...systemctlBase(scope), "show", validateUnitName(unit),
        "--property=LoadState,ActiveState,SubState,UnitFileState,ExecMainStatus",
        "--no-pager",
    ];
}

/** Glob patterns here are plugin constants, never user input — still checked. */
const UNIT_GLOB_RE = /^[A-Za-z0-9@:._*?-]+$/;

export function buildListUnitFilesArgs(patterns: string[], scope: UnitScope = "system"): string[] {
    for (const pattern of patterns) {
        if (!UNIT_GLOB_RE.test(pattern) || pattern.startsWith("-"))
            throw new ValidationError(`Invalid unit pattern: ${JSON.stringify(pattern)}.`);
    }
    return [
        ...systemctlBase(scope), "list-unit-files", "--type=service",
        "--no-legend", "--no-pager", "--plain", ...patterns,
    ];
}

export function buildJournalArgs(unit: string, lines: number, priority?: number | null, scope: UnitScope = "system"): string[] {
    validateUnitName(unit);
    if (!(LOG_LINE_CHOICES as readonly number[]).includes(lines))
        throw new ValidationError(`Unsupported log line count: ${JSON.stringify(lines)}.`);
    const args = ["journalctl"];
    if (scope === "user")
        args.push("--user");
    args.push("-u", unit, "-n", String(lines), "--no-pager", "-o", "short-iso");
    if (priority !== undefined && priority !== null) {
        if (!Number.isInteger(priority) || priority < 0 || priority > 7)
            throw new ValidationError(`Invalid journal priority: ${JSON.stringify(priority)}.`);
        args.push("-p", String(priority));
    }
    return args;
}

/**
 * grdctl reads the calling user's GNOME Remote Desktop configuration by
 * default; "--system" reads the separate system daemon that backs GNOME's
 * "Remote Login" (headless) sessions.
 */
export function buildGrdctlStatusArgs(scope: "user" | "system" = "user"): string[] {
    return scope === "system" ? ["grdctl", "--system", "status"] : ["grdctl", "status"];
}

export function buildGrdctlVncEnableArgs(): string[] {
    return ["grdctl", "vnc", "enable"];
}

/** Password is fed via stdin — it must never appear in any argv. */
export function buildGrdctlVncSetPasswordArgs(): string[] {
    return ["grdctl", "vnc", "set-password"];
}

export function buildGrdctlVncSetAuthMethodArgs(method: "password" | "prompt"): string[] {
    if (method !== "password" && method !== "prompt")
        throw new ValidationError(`Unsupported GNOME Remote Desktop VNC auth method: ${JSON.stringify(method)}.`);
    return ["grdctl", "vnc", "set-auth-method", method];
}

/*
 * grdctl exposes no VNC screen-share mode, so it is read and written straight
 * from GNOME Remote Desktop's GSettings schema. Schema and key are constants
 * here and the value is checked against the schema's enum, so no caller can
 * aim gsettings at another setting.
 */
const VNC_SCREEN_SHARE_SCHEMA = "org.gnome.desktop.remote-desktop.vnc";
const VNC_SCREEN_SHARE_KEY = "screen-share-mode";
const VNC_SCREEN_SHARE_MODES: readonly GrdVncScreenShareMode[] = ["mirror-primary", "extend"];

export function buildVncScreenShareModeGetArgs(): string[] {
    return ["gsettings", "get", VNC_SCREEN_SHARE_SCHEMA, VNC_SCREEN_SHARE_KEY];
}

export function buildVncScreenShareModeSetArgs(mode: GrdVncScreenShareMode): string[] {
    if (!VNC_SCREEN_SHARE_MODES.includes(mode))
        throw new ValidationError(`Unsupported VNC screen-share mode: ${JSON.stringify(mode)}.`);
    return ["gsettings", "set", VNC_SCREEN_SHARE_SCHEMA, VNC_SCREEN_SHARE_KEY, mode];
}

export function buildSsListeningArgs(): string[] {
    return ["ss", "-tlnH"];
}

/** Process ownership identifies a negotiated per-user GNOME RDP port. */
export function buildSsListeningProcessArgs(): string[] {
    return ["ss", "-tlnpH"];
}

export function buildWhichArgs(binary: string): string[] {
    return ["which", validateBinaryName(binary)];
}

export function buildTestExecutableArgs(path: string): string[] {
    return ["test", "-x", validatePath(path)];
}

export function buildVersionArgs(binary: string, flag: "-version" | "--version"): string[] {
    validateBinaryName(binary);
    if (flag !== "-version" && flag !== "--version")
        throw new ValidationError(`Invalid version flag: ${JSON.stringify(flag)}.`);
    return [binary, flag];
}

/** Password is fed via stdin — it must never appear in any argv. */
export function buildVncpasswdArgs(): string[] {
    return ["vncpasswd", "-f"];
}

export function buildGetentPasswdArgs(user: string): string[] {
    return ["getent", "passwd", validateUsername(user)];
}

export function buildMkdirArgs(path: string): string[] {
    return ["mkdir", "-p", validatePath(path)];
}

const FILE_MODE_RE = /^[0-7]{3,4}$/;

export function buildChmodArgs(mode: string, path: string): string[] {
    if (!FILE_MODE_RE.test(mode))
        throw new ValidationError(`Invalid file mode: ${JSON.stringify(mode)}.`);
    return ["chmod", mode, validatePath(path)];
}

/** chown "user:" sets the group to the user's login group. */
export function buildChownArgs(user: string, path: string): string[] {
    return ["chown", `${validateUsername(user)}:`, validatePath(path)];
}

export function buildLoginctlListArgs(): string[] {
    return ["loginctl", "list-sessions", "--no-legend", "--no-pager"];
}

export function buildLoginctlShowSessionArgs(sessionId: string): string[] {
    // One --property flag per name: unlike systemctl, loginctl silently
    // prints nothing for a comma-separated property list.
    return [
        "loginctl", "show-session", validateSessionId(sessionId),
        "--property=Id", "--property=Type", "--property=Desktop",
        "--property=Display", "--property=Active", "--property=Class",
        "--property=Name",
    ];
}

/** Used by health checks to probe TCP reachability without extra tools. */
export function buildPortProbeArgs(port: number): string[] {
    validatePort(port);
    return ["ss", "-tlnH", `sport = :${port}`];
}
