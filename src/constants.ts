import type { BackendId, UiPrefs } from "./types";

/** Machine-wide plugin configuration (JSON), readable by any admin session. */
export const CONFIG_PATH = "/etc/cockpit/cockpitremote.json";

/** Root-owned directory for plugin-managed files (x11vnc password file). */
export const PLUGIN_STATE_DIR = "/etc/cockpitremote";
export const X11VNC_PASSWD_PATH = `${PLUGIN_STATE_DIR}/x11vnc.passwd`;

export const DEFAULT_VNC_PORT = 5901;
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
    /** Binary names probed in order; the first found wins. */
    binaries: string[];
    versionFlag: "-version" | "--version";
    /** systemd units that identify this backend, matched by prefix. */
    unitPrefix: string;
    /** Startable unit suggested when only a template/none is found. */
    defaultUnit: string;
    defaultPort: number;
    description: string;
    packages: { dnf: string; apt: string; zypper: string };
    /** Whether the plugin can manage a password for it via vncpasswd. */
    supportsPasswordTool: boolean;
    /** Whether connecting/managing it is supported by this plugin version. */
    manageable: boolean;
}

export const BACKENDS: BackendDef[] = [
    {
        id: "tigervnc",
        label: "TigerVNC (virtual desktop session)",
        binaries: ["Xvnc", "Xtigervnc"],
        versionFlag: "-version",
        unitPrefix: "vncserver@",
        defaultUnit: "vncserver@:1.service",
        defaultPort: 5901,
        description:
            "Runs a separate virtual desktop session on the host. Recommended for servers " +
            "and for modern Fedora/RHEL Workstation, where the physical GNOME Wayland " +
            "session cannot be shared over VNC.",
        packages: {
            dnf: "tigervnc-server",
            apt: "tigervnc-standalone-server",
            zypper: "tigervnc",
        },
        supportsPasswordTool: true,
        manageable: true,
    },
    {
        id: "x11vnc",
        label: "x11vnc (share existing X11 session)",
        binaries: ["x11vnc"],
        versionFlag: "-version",
        unitPrefix: "x11vnc",
        defaultUnit: "x11vnc.service",
        defaultPort: 5900,
        description:
            "Mirrors an already-running X11 session (the physical monitor). Requires the " +
            "host to run Xorg — not available on GNOME Wayland desktops.",
        packages: { dnf: "x11vnc", apt: "x11vnc", zypper: "x11vnc" },
        supportsPasswordTool: true,
        manageable: true,
    },
    {
        id: "wayvnc",
        label: "wayvnc (wlroots Wayland compositors)",
        binaries: ["wayvnc"],
        versionFlag: "--version",
        unitPrefix: "wayvnc",
        defaultUnit: "wayvnc.service",
        defaultPort: 5900,
        description:
            "Shares a Wayland session on wlroots-based compositors (Sway, Hyprland, ...). " +
            "Not compatible with GNOME or KDE Wayland sessions.",
        packages: { dnf: "wayvnc", apt: "wayvnc", zypper: "wayvnc" },
        supportsPasswordTool: false,
        manageable: true,
    },
    {
        id: "grd",
        label: "GNOME Remote Desktop",
        binaries: ["grdctl"],
        versionFlag: "--version",
        unitPrefix: "gnome-remote-desktop",
        defaultUnit: "gnome-remote-desktop.service",
        defaultPort: 5900,
        description:
            "GNOME's built-in remote desktop. Recent versions are RDP-only (VNC support " +
            "was deprecated and removed), so this plugin detects it for information but " +
            "cannot connect to it.",
        packages: {
            dnf: "gnome-remote-desktop",
            apt: "gnome-remote-desktop",
            zypper: "gnome-remote-desktop",
        },
        supportsPasswordTool: false,
        manageable: false,
    },
];

export function backendDef(id: BackendId): BackendDef {
    const def = BACKENDS.find(b => b.id === id);
    if (!def)
        throw new Error(`unknown backend: ${id}`);
    return def;
}
