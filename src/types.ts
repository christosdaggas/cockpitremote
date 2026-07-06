export type BackendId = "grd" | "grd-rdp";
export type BackendProtocol = "vnc" | "rdp";

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
}

export interface ListeningSocket {
    address: string;
    port: number;
}

export interface RemoteConfig {
    backend: BackendId | null;
    unit: string;
    address: string;
    port: number;
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
