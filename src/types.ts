export type BackendId = "tigervnc" | "x11vnc" | "wayvnc" | "grd";

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
    /** Desired virtual-desktop geometry; guidance for TigerVNC setup only. */
    geometry: string;
    /** Unix user owning the TigerVNC session (placement of ~/.vnc/passwd). */
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

export interface OsInfo {
    id: string;
    idLike: string[];
    prettyName: string;
    packageManager: "dnf" | "apt" | "zypper" | null;
}
