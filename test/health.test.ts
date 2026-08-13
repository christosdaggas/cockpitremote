import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../src/services/config";
import type { BackendInfo, RemoteConfig } from "../src/types";
import { computeHealthChecks } from "../src/utils/health";

function grdBackend(overrides: Partial<BackendInfo> = {}): BackendInfo {
    return {
        id: "grd",
        label: "GNOME VNC",
        protocol: "vnc",
        binaryPath: "/usr/bin/grdctl",
        version: "50.1",
        detectedUnit: "gnome-remote-desktop.service",
        unitScope: "user",
        status: {
            exists: true,
            loadState: "loaded",
            activeState: "active",
            subState: "running",
            unitFileState: "enabled",
            execMainStatus: 0,
        },
        supported: true,
        notes: [],
        defaultPort: 5900,
        detectedPort: 5900,
        remoteLoginPort: null,
        ...overrides,
    };
}

const config: RemoteConfig = {
    ...DEFAULT_CONFIG,
    backend: "grd",
    unit: "gnome-remote-desktop.service",
    port: 5900,
};

describe("computeHealthChecks", () => {
    it("reports all-green for a healthy localhost setup", () => {
        const checks = computeHealthChecks({
            transportAvailable: true,
            config,
            activeUnit: "gnome-remote-desktop.service",
            backends: [grdBackend()],
            session: { type: "wayland", desktop: "GNOME", display: null, user: "alice" },
            sockets: [{ address: "127.0.0.1", port: 5900 }, { address: "::1", port: 4822 }],
            loginUser: "alice",
        });
        expect(checks.every(c => c.state === "ok")).toBe(true);
    });

    it("flags a missing transport as an error", () => {
        const checks = computeHealthChecks({
            transportAvailable: false,
            config,
            activeUnit: "gnome-remote-desktop.service",
            backends: [grdBackend()],
            session: null,
            sockets: [],
        });
        expect(checks.find(c => c.id === "transport")?.state).toBe("error");
    });

    it("warns when no backend is selected", () => {
        const checks = computeHealthChecks({
            transportAvailable: true,
            config: DEFAULT_CONFIG,
            activeUnit: "",
            backends: [grdBackend()],
            session: null,
            sockets: [],
        });
        expect(checks.find(c => c.id === "backend")?.state).toBe("warning");
    });

    it("errors when the service is active but the port is closed", () => {
        const checks = computeHealthChecks({
            transportAvailable: true,
            config,
            activeUnit: "gnome-remote-desktop.service",
            backends: [grdBackend()],
            session: null,
            sockets: [],
        });
        expect(checks.find(c => c.id === "port")?.state).toBe("error");
    });

    it("warns when the VNC port is exposed beyond loopback", () => {
        const checks = computeHealthChecks({
            transportAvailable: true,
            config,
            activeUnit: "gnome-remote-desktop.service",
            backends: [grdBackend()],
            session: null,
            sockets: [{ address: "0.0.0.0", port: 5900 }],
        });
        const port = checks.find(c => c.id === "port");
        expect(port?.state).toBe("warning");
        expect(port?.detail).toMatch(/firewall/);
    });

    it("labels and explains an exposed RDP port", () => {
        const rdpConfig: RemoteConfig = {
            ...DEFAULT_CONFIG,
            backend: "grd-rdp",
            unit: "gnome-remote-desktop.service",
            port: 3389,
        };
        const checks = computeHealthChecks({
            transportAvailable: true,
            config: rdpConfig,
            activeUnit: "gnome-remote-desktop.service",
            backends: [grdBackend({ id: "grd-rdp", label: "GNOME RDP", protocol: "rdp", defaultPort: 3389, detectedPort: 3389 })],
            session: { type: "wayland", desktop: "GNOME", display: null, user: "alice" },
            sockets: [{ address: "*", port: 3389 }],
            loginUser: "alice",
        });
        const port = checks.find(c => c.id === "port");
        expect(port?.label).toBe("RDP port 3389");
        expect(port?.detail).toMatch(/RDP clients/);
    });

    it("reports the guacd gateway for GNOME backends", () => {
        const rdpConfig: RemoteConfig = {
            ...DEFAULT_CONFIG,
            backend: "grd-rdp",
            unit: "gnome-remote-desktop.service",
            port: 3389,
        };
        const backend = grdBackend({
            id: "grd-rdp",
            label: "GNOME RDP",
            protocol: "rdp",
            defaultPort: 3389,
            detectedPort: 3389,
        });

        const missing = computeHealthChecks({
            transportAvailable: true,
            config: rdpConfig,
            activeUnit: "gnome-remote-desktop.service",
            backends: [backend],
            session: { type: "wayland", desktop: "GNOME", display: null, user: "alice" },
            sockets: [{ address: "127.0.0.1", port: 3389 }],
            loginUser: "alice",
        });
        expect(missing.find(c => c.id === "guacd")?.state).toBe("error");

        const present = computeHealthChecks({
            transportAvailable: true,
            config: rdpConfig,
            activeUnit: "gnome-remote-desktop.service",
            backends: [backend],
            session: { type: "wayland", desktop: "GNOME", display: null, user: "alice" },
            sockets: [{ address: "127.0.0.1", port: 3389 }, { address: "::1", port: 4822 }],
            loginUser: "alice",
        });
        expect(present.find(c => c.id === "guacd")?.state).toBe("ok");

        const vnc = computeHealthChecks({
            transportAvailable: true,
            config,
            activeUnit: "gnome-remote-desktop.service",
            backends: [grdBackend()],
            session: { type: "wayland", desktop: "GNOME", display: null, user: "alice" },
            sockets: [{ address: "127.0.0.1", port: 5900 }, { address: "::1", port: 4822 }],
            loginUser: "alice",
        });
        expect(vnc.find(c => c.id === "guacd")?.state).toBe("ok");
    });

    it("errors when the configured unit does not exist", () => {
        const backend = grdBackend({
            status: {
                exists: false,
                loadState: "not-found",
                activeState: "inactive",
                subState: "dead",
                unitFileState: "",
                execMainStatus: null,
            },
        });
        const checks = computeHealthChecks({
            transportAvailable: true,
            config,
            activeUnit: "gnome-remote-desktop.service",
            backends: [backend],
            session: null,
            sockets: [],
        });
        expect(checks.find(c => c.id === "unit")?.state).toBe("error");
    });

    it("warns when the desktop session belongs to a different user than the Cockpit login (grd)", () => {
        const grdConfig: RemoteConfig = {
            ...DEFAULT_CONFIG,
            backend: "grd",
            unit: "gnome-remote-desktop.service",
            port: 5900,
        };
        const base = {
            transportAvailable: true,
            config: grdConfig,
            activeUnit: "gnome-remote-desktop.service",
            backends: [grdBackend()],
            sockets: [{ address: "*", port: 5900 }],
        };

        const mismatch = computeHealthChecks({
            ...base,
            session: { type: "wayland" as const, desktop: "GNOME", display: null, user: "alice" },
            loginUser: "bob",
        });
        expect(mismatch.find(c => c.id === "session")?.state).toBe("warning");
        expect(mismatch.find(c => c.id === "session")?.detail).toMatch(/alice/);

        const match = computeHealthChecks({
            ...base,
            session: { type: "wayland" as const, desktop: "GNOME", display: null, user: "alice" },
            loginUser: "alice",
        });
        expect(match.find(c => c.id === "session")?.state).toBe("ok");

        const noDesktop = computeHealthChecks({ ...base, session: null, loginUser: "alice" });
        expect(noDesktop.find(c => c.id === "session")?.state).toBe("warning");
    });
});
