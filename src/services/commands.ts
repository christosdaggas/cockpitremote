/*
 * The ONLY place where command argument arrays are assembled. Every builder
 * validates its inputs (utils/validation.ts) and returns a plain argv array —
 * cockpit.spawn() is never called with shell interpolation anywhere in this
 * codebase, so nothing here can be turned into shell injection.
 */

import type { SystemdAction } from "../types";
import {
    ValidationError,
    validateBinaryName,
    validatePackageName,
    validatePath,
    validatePort,
    validateSessionId,
    validateUnitName,
    validateUsername,
} from "../utils/validation";
import { LOG_LINE_CHOICES } from "../constants";

const SYSTEMD_ACTIONS: readonly SystemdAction[] = ["start", "stop", "restart", "enable", "disable"];

export function buildSystemctlActionArgs(action: SystemdAction, unit: string): string[] {
    if (!SYSTEMD_ACTIONS.includes(action))
        throw new ValidationError(`Unsupported systemd action: ${JSON.stringify(action)}.`);
    return ["systemctl", action, validateUnitName(unit)];
}

export function buildSystemctlShowArgs(unit: string): string[] {
    return [
        "systemctl", "show", validateUnitName(unit),
        "--property=LoadState,ActiveState,SubState,UnitFileState,ExecMainStatus",
        "--no-pager",
    ];
}

/** Glob patterns here are plugin constants, never user input — still checked. */
const UNIT_GLOB_RE = /^[A-Za-z0-9@:._*?-]+$/;

export function buildListUnitFilesArgs(patterns: string[]): string[] {
    for (const pattern of patterns) {
        if (!UNIT_GLOB_RE.test(pattern) || pattern.startsWith("-"))
            throw new ValidationError(`Invalid unit pattern: ${JSON.stringify(pattern)}.`);
    }
    return [
        "systemctl", "list-unit-files", "--type=service",
        "--no-legend", "--no-pager", "--plain", ...patterns,
    ];
}

export function buildJournalArgs(unit: string, lines: number, priority?: number | null): string[] {
    validateUnitName(unit);
    if (!(LOG_LINE_CHOICES as readonly number[]).includes(lines))
        throw new ValidationError(`Unsupported log line count: ${JSON.stringify(lines)}.`);
    const args = ["journalctl", "-u", unit, "-n", String(lines), "--no-pager", "-o", "short-iso"];
    if (priority !== undefined && priority !== null) {
        if (!Number.isInteger(priority) || priority < 0 || priority > 7)
            throw new ValidationError(`Invalid journal priority: ${JSON.stringify(priority)}.`);
        args.push("-p", String(priority));
    }
    return args;
}

export function buildSsListeningArgs(): string[] {
    return ["ss", "-tlnH"];
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

export type PackageManager = "dnf" | "apt" | "zypper";

export function buildInstallPackagesArgs(pm: PackageManager, packages: string[]): string[] {
    if (packages.length === 0)
        throw new ValidationError("No packages given.");
    const validated = packages.map(validatePackageName);
    switch (pm) {
    case "dnf":
        return ["dnf", "install", "-y", ...validated];
    case "apt":
        return ["apt-get", "install", "-y", ...validated];
    case "zypper":
        return ["zypper", "--non-interactive", "install", ...validated];
    default:
        throw new ValidationError(`Unsupported package manager: ${JSON.stringify(pm)}.`);
    }
}

export function buildLoginctlListArgs(): string[] {
    return ["loginctl", "list-sessions", "--no-legend", "--no-pager"];
}

export function buildLoginctlShowSessionArgs(sessionId: string): string[] {
    return [
        "loginctl", "show-session", validateSessionId(sessionId),
        "--property=Id,Type,Desktop,Display,Active,Class",
    ];
}

/** Used by health checks to probe TCP reachability without extra tools. */
export function buildPortProbeArgs(port: number): string[] {
    validatePort(port);
    return ["ss", "-tlnH", `sport = :${port}`];
}
