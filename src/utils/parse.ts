// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

/*
 * Pure parsers for machine-readable command output. Each one is fed the
 * verbatim stdout of a command built in services/commands.ts and is tested
 * against captured fixtures in test/parse.test.ts.
 */

import type { ListeningSocket } from "../types";

/** Parses `KEY=value` line output (systemctl show, loginctl show-session). */
export function parseKeyValueOutput(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of text.split("\n")) {
        const idx = line.indexOf("=");
        if (idx > 0)
            result[line.slice(0, idx)] = line.slice(idx + 1);
    }
    return result;
}

/** First column of `systemctl list-unit-files --no-legend --plain` output. */
export function parseUnitFiles(text: string): string[] {
    return text
        .split("\n")
        .map(line => line.trim().split(/\s+/)[0])
        .filter(name => name !== undefined && name.endsWith(".service"));
}

/**
 * Parses `ss -tlnH` output. Expected line shape:
 *   LISTEN 0 128 127.0.0.1:5900 0.0.0.0:*
 * IPv6 local addresses look like "[::1]:5900"; wildcards like "*:5900".
 */
export function parseSsListening(text: string): ListeningSocket[] {
    const sockets: ListeningSocket[] = [];
    for (const line of text.split("\n")) {
        const cols = line.trim().split(/\s+/);
        if (cols.length < 4)
            continue;
        const local = cols[3];
        const idx = local.lastIndexOf(":");
        if (idx < 0)
            continue;
        const port = Number(local.slice(idx + 1));
        if (!Number.isInteger(port) || port <= 0)
            continue;
        let address = local.slice(0, idx);
        if (address.startsWith("[") && address.endsWith("]"))
            address = address.slice(1, -1);
        const processes = [...line.matchAll(/\(\("([^"]+)"/g)].map(match => match[1]);
        sockets.push(processes.length > 0 ? { address, port, processes } : { address, port });
    }
    return sockets;
}

/** Parses os-release contents into a key/value map with quotes stripped. */
export function parseOsRelease(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of text.split("\n")) {
        const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
        if (!m)
            continue;
        let value = m[2];
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'")))
            value = value.slice(1, -1);
        result[m[1]] = value;
    }
    return result;
}

export interface PasswdEntry {
    user: string;
    uid: number;
    gid: number;
    home: string;
    shell: string;
}

/** Parses one `getent passwd <user>` line. */
export function parseGetentPasswd(text: string): PasswdEntry | null {
    const line = text.split("\n").find(l => l.includes(":"));
    if (!line)
        return null;
    const fields = line.split(":");
    if (fields.length < 7)
        return null;
    const uid = Number(fields[2]);
    const gid = Number(fields[3]);
    if (!Number.isInteger(uid) || !Number.isInteger(gid))
        return null;
    return { user: fields[0], uid, gid, home: fields[5], shell: fields[6] };
}

/**
 * First column (session id) of `loginctl list-sessions --no-legend`.
 * Column layout differs across systemd versions, but the id is always first.
 */
export function parseSessionIds(text: string): string[] {
    return text
        .split("\n")
        .map(line => line.trim().split(/\s+/)[0])
        .filter(id => id !== undefined && id.length > 0);
}

/**
 * Unwraps the single GVariant `gsettings get` prints. Strings and enums come
 * back quoted ("'extend'\n"); anything else is handed back trimmed.
 */
export function parseGsettingsValue(text: string): string {
    const value = text.trim();
    return value.length >= 2 && value.startsWith("'") && value.endsWith("'")
        ? value.slice(1, -1)
        : value;
}

/** Pulls the first version-looking token (e.g. "1.13.1") out of tool output. */
export function extractVersion(text: string): string | null {
    const m = /(\d+\.\d+(?:\.\d+)*)/.exec(text);
    return m ? m[1] : null;
}

export interface GrdStatus {
    hasRdp: boolean;
    rdpEnabled: boolean;
    rdpPort: number | null;
    rdpNegotiatePort: boolean;
    rdpViewOnly: boolean;
    rdpAuthMethods: string | null;
    rdpPasswordEmpty: boolean;
    /** False when the installed build was compiled without the VNC backend. */
    hasVnc: boolean;
    vncEnabled: boolean;
    vncPort: number | null;
    vncViewOnly: boolean;
    /** "prompt" (approve on the desktop) or "password". */
    vncAuthMethod: string | null;
    /** True when password auth is selected but no password is stored. */
    vncPasswordEmpty: boolean;
}

/**
 * Parses `grdctl status` output. The output is grouped into sections whose
 * headers ("Overall:", "RDP:", "VNC:") start at column 0; the fields below
 * them are indented ("\tStatus: enabled"). RDP-only builds print no VNC
 * section at all, which is exactly the capability signal we need.
 */
export function parseGrdStatus(text: string): GrdStatus {
    const status: GrdStatus = {
        hasRdp: false,
        rdpEnabled: false,
        rdpPort: null,
        rdpNegotiatePort: false,
        rdpViewOnly: false,
        rdpAuthMethods: null,
        rdpPasswordEmpty: false,
        hasVnc: false,
        vncEnabled: false,
        vncPort: null,
        vncViewOnly: false,
        vncAuthMethod: null,
        vncPasswordEmpty: false,
    };
    let section: "rdp" | "vnc" | null = null;
    for (const line of text.split("\n")) {
        if (/^\S/.test(line)) {
            const header = line.trim();
            if (header === "RDP:") {
                section = "rdp";
                status.hasRdp = true;
            } else if (header === "VNC:") {
                section = "vnc";
                status.hasVnc = true;
            } else {
                section = null;
            }
            continue;
        }
        if (!section)
            continue;
        const idx = line.indexOf(":");
        if (idx < 0)
            continue;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (section === "rdp") {
            if (key === "Status")
                status.rdpEnabled = value === "enabled";
            else if (key === "Port") {
                const port = Number(value);
                if (Number.isInteger(port) && port > 0)
                    status.rdpPort = port;
            } else if (key === "View-only")
                status.rdpViewOnly = value === "yes";
            else if (key === "Negotiate port")
                status.rdpNegotiatePort = value === "yes";
            else if (key === "Authentication methods")
                status.rdpAuthMethods = value || null;
            else if (key === "Password")
                status.rdpPasswordEmpty = value === "(empty)";
        } else if (key === "Status")
            status.vncEnabled = value === "enabled";
        else if (key === "Port") {
            const port = Number(value);
            if (Number.isInteger(port) && port > 0)
                status.vncPort = port;
        } else if (key === "View-only")
            status.vncViewOnly = value === "yes";
        else if (key === "Auth method")
            status.vncAuthMethod = value || null;
        else if (key === "Password")
            status.vncPasswordEmpty = value === "(empty)";
    }
    return status;
}
