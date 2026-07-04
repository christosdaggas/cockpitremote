import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../src/services/config";
import type { BackendInfo, RemoteConfig } from "../src/types";
import { computeHealthChecks } from "../src/utils/health";

function tigervncBackend(overrides: Partial<BackendInfo> = {}): BackendInfo {
    return {
        id: "tigervnc",
        label: "TigerVNC (virtual desktop session)",
        binaryPath: "/usr/bin/Xvnc",
        version: "1.13.1",
        detectedUnit: "vncserver@:1.service",
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
        defaultPort: 5901,
        ...overrides,
    };
}

const config: RemoteConfig = {
    ...DEFAULT_CONFIG,
    backend: "tigervnc",
    unit: "vncserver@:1.service",
    port: 5901,
};

describe("computeHealthChecks", () => {
    it("reports all-green for a healthy localhost setup", () => {
        const checks = computeHealthChecks({
            transportAvailable: true,
            config,
            activeUnit: "vncserver@:1.service",
            backends: [tigervncBackend()],
            session: { type: "wayland", desktop: "GNOME", display: null },
            sockets: [{ address: "127.0.0.1", port: 5901 }],
        });
        expect(checks.every(c => c.state === "ok")).toBe(true);
    });

    it("flags a missing transport as an error", () => {
        const checks = computeHealthChecks({
            transportAvailable: false,
            config,
            activeUnit: "vncserver@:1.service",
            backends: [tigervncBackend()],
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
            backends: [tigervncBackend()],
            session: null,
            sockets: [],
        });
        expect(checks.find(c => c.id === "backend")?.state).toBe("warning");
    });

    it("errors when the service is active but the port is closed", () => {
        const checks = computeHealthChecks({
            transportAvailable: true,
            config,
            activeUnit: "vncserver@:1.service",
            backends: [tigervncBackend()],
            session: null,
            sockets: [],
        });
        expect(checks.find(c => c.id === "port")?.state).toBe("error");
    });

    it("warns when the VNC port is exposed beyond loopback", () => {
        const checks = computeHealthChecks({
            transportAvailable: true,
            config,
            activeUnit: "vncserver@:1.service",
            backends: [tigervncBackend()],
            session: null,
            sockets: [{ address: "0.0.0.0", port: 5901 }],
        });
        const port = checks.find(c => c.id === "port");
        expect(port?.state).toBe("warning");
        expect(port?.detail).toMatch(/127\.0\.0\.1/);
    });

    it("errors when the configured unit does not exist", () => {
        const backend = tigervncBackend({
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
            activeUnit: "vncserver@:1.service",
            backends: [backend],
            session: null,
            sockets: [],
        });
        expect(checks.find(c => c.id === "unit")?.state).toBe("error");
    });
});
