// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

export type BackendId = "grd" | "grd-rdp";
export type BackendProtocol = "vnc" | "rdp";

/**
 * Which GNOME Remote Desktop RDP endpoint to connect to. Both daemons can run
 * at once on different ports:
 *  - "screen-share"  mirrors the logged-in GNOME session (user daemon). Its
 *    resolution is fixed by the physical monitor and ignores client resizes.
 *  - "remote-login"  starts a headless session (system daemon, GNOME's
 *    "Remote Login"), which adopts the resolution the client asks for.
 */
export type GrdRdpMode = "screen-share" | "remote-login";

/**
 * Where GNOME Remote Desktop's VNC endpoint gets a screen from. grdctl has no
 * subcommand for it, so it lives in GSettings:
 *  - "mirror-primary"  records the primary monitor of the logged-in GNOME
 *    session. Nobody logged in at a monitor means nothing to record, and the
 *    connection is dropped right after authentication.
 *  - "extend"          creates a virtual monitor for the connection, so it
 *    works headless and follows the resolution the client asks for.
 */
export type GrdVncScreenShareMode = "mirror-primary" | "extend";

export type SystemdAction = "start" | "stop" | "restart" | "enable" | "disable";

/**
 * Which systemd manager owns a backend's unit: the system manager, or the
 * Cockpit user's session manager (`systemctl --user`, as GNOME Remote
 * Desktop uses).
 */
export type UnitScope = "system" | "user";

export interface ServiceStatus {
    exists: boolean;
    loadState: string;
    activeState: string;
    subState: string;
    unitFileState: string;
    execMainStatus: number | null;
}

export interface SessionInfo {
    type: "x11" | "wayland" | "tty" | "none";
    desktop: string | null;
    display: string | null;
    /** Unix user owning the session (logind "Name"). */
    user: string | null;
}

export interface BackendInfo {
    id: BackendId;
    label: string;
    protocol: BackendProtocol;
    binaryPath: string | null;
    version: string | null;
    detectedUnit: string | null;
    unitScope: UnitScope;
    status: ServiceStatus | null;
    supported: boolean;
    notes: string[];
    defaultPort: number;
    /** Port the backend reports it actually uses (grdctl), when known. */
    detectedPort: number | null;
    /**
     * Port the system "Remote Login" daemon listens on, when it is enabled.
     * Null for VNC and whenever headless RDP is unavailable.
     */
    remoteLoginPort: number | null;
    /**
     * How the VNC endpoint obtains a screen. Null for RDP and whenever the
     * setting could not be read (RDP-only builds have no such schema).
     */
    vncScreenShareMode: GrdVncScreenShareMode | null;
}

export interface ListeningSocket {
    address: string;
    port: number;
    /** Process names reported by `ss -p`, when visible to the Cockpit user. */
    processes?: string[];
}

export interface RemoteConfig {
    backend: BackendId | null;
    unit: string;
    address: string;
    port: number;
    /** Which RDP endpoint to use; ignored by the VNC backend. */
    rdpMode: GrdRdpMode;
    /** Optional geometry hint retained for existing config files. */
    geometry: string;
    /** Optional legacy VNC user retained for existing config files. */
    vncUser: string;
}

export interface UiPrefs {
    qualityLevel: number;
    compressionLevel: number;
    scaleViewport: boolean;
    viewOnly: boolean;
    logLines: number;
    logPriority: number | null;
}

export type HealthState = "ok" | "warning" | "error" | "unknown";

export interface HealthCheck {
    id: string;
    label: string;
    state: HealthState;
    detail: string;
}
