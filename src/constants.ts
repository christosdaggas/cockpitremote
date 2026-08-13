import type { BackendId, BackendProtocol, UiPrefs, UnitScope } from "./types";

/** Machine-wide plugin configuration (JSON), readable by any admin session. */
export const CONFIG_PATH = "/etc/cockpit/cockpitremote.json";

export const DEFAULT_VNC_PORT = 5900;
export const DEFAULT_RDP_PORT = 3389;
export const GUACD_ADDRESS = "localhost";
export const GUACD_PORT = 4822;
export const GUACD_UNIT = "guacd.service";
export const RDP_DPI = 96;
export const CONNECT_TIMEOUT_MS = 15000;

export const LOG_LINE_CHOICES = [100, 200, 500, 1000] as const;

/** journalctl -p levels offered in the UI (null = all). */
export const LOG_PRIORITIES: Array<{ label: string; value: number | null }> = [
    { label: "All levels", value: null },
    { label: "Error and worse", value: 3 },
    { label: "Warning and worse", value: 4 },
    { label: "Notice and worse", value: 5 },
    { label: "Info and worse", value: 6 },
    { label: "Debug (everything)", value: 7 },
];

export const DEFAULT_PREFS: UiPrefs = {
    qualityLevel: 6,
    compressionLevel: 2,
    scaleViewport: true,
    viewOnly: false,
    logLines: 200,
    logPriority: null,
};

export interface BackendDef {
    id: BackendId;
    label: string;
    protocol: BackendProtocol;
    /** Binary names probed in order; the first found wins. */
    binaries: string[];
    versionFlag: "-version" | "--version";
    /** systemd units that identify this backend, matched by prefix. */
    unitPrefix: string;
    /** Startable unit suggested when only a template/none is found. */
    defaultUnit: string;
    /** Whether the unit lives in the system or the user's session manager. */
    unitScope: UnitScope;
    defaultPort: number;
    description: string;
    /** Whether the plugin can manage a password for this backend. */
    supportsPasswordTool: boolean;
    /** Whether connecting/managing it is supported by this plugin version. */
    manageable: boolean;
}

export const BACKENDS: BackendDef[] = [
    {
        id: "grd",
        label: "GNOME VNC",
        protocol: "vnc",
        binaries: ["grdctl"],
        versionFlag: "--version",
        unitPrefix: "gnome-remote-desktop",
        defaultUnit: "gnome-remote-desktop.service",
        unitScope: "user",
        defaultPort: 5900,
        description:
            "GNOME Remote Desktop's VNC endpoint, sharing the logged-in GNOME session " +
            "when this GNOME build provides VNC support.",
        supportsPasswordTool: true,
        manageable: true,
    },
    {
        id: "grd-rdp",
        label: "GNOME RDP",
        protocol: "rdp",
        binaries: ["grdctl"],
        versionFlag: "--version",
        unitPrefix: "gnome-remote-desktop",
        defaultUnit: "gnome-remote-desktop.service",
        unitScope: "user",
        defaultPort: DEFAULT_RDP_PORT,
        description:
            "GNOME Remote Desktop's RDP endpoint, sharing the logged-in GNOME session " +
            "through the standard Remote Desktop Protocol.",
        supportsPasswordTool: false,
        manageable: true,
    },
];

export function backendDef(id: BackendId): BackendDef {
    const def = BACKENDS.find(b => b.id === id);
    if (!def)
        throw new Error(`unknown backend: ${id}`);
    return def;
}
