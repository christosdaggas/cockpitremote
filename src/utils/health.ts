/*
 * Pure computation of the dashboard health checks from already-gathered
 * system facts — kept free of I/O so it is trivially unit-testable.
 */

import type { BackendInfo, HealthCheck, ListeningSocket, RemoteConfig, SessionInfo } from "../types";
import { checkPort } from "../services/network";

export interface HealthInput {
    transportAvailable: boolean;
    config: RemoteConfig;
    activeUnit: string;
    backends: BackendInfo[];
    session: SessionInfo | null;
    sockets: ListeningSocket[];
}

export function computeHealthChecks(input: HealthInput): HealthCheck[] {
    const { transportAvailable, config, activeUnit, backends, session, sockets } = input;
    const checks: HealthCheck[] = [];

    checks.push(transportAvailable
        ? { id: "transport", label: "Cockpit console transport", state: "ok", detail: "Available" }
        : {
            id: "transport",
            label: "Cockpit console transport",
            state: "error",
            detail: "This Cockpit version does not expose the channel WebSocket API. Upgrade Cockpit.",
        });

    const backend = backends.find(b => b.id === config.backend);
    if (!backend) {
        checks.push({
            id: "backend",
            label: "VNC backend",
            state: "warning",
            detail: "No backend selected yet. Pick one on this page or in Settings.",
        });
        return checks;
    }

    checks.push(backend.binaryPath
        ? { id: "backend", label: "VNC backend", state: "ok", detail: `${backend.label} (${backend.binaryPath})` }
        : { id: "backend", label: "VNC backend", state: "error", detail: `${backend.label} is not installed.` });

    if (activeUnit) {
        if (backend.status === null || backend.detectedUnit !== activeUnit) {
            checks.push({
                id: "unit",
                label: "systemd unit",
                state: "unknown",
                detail: `${activeUnit} (state not inspected yet — refresh)`,
            });
        } else if (!backend.status.exists) {
            checks.push({
                id: "unit",
                label: "systemd unit",
                state: "error",
                detail: `${activeUnit} was not found. Check the unit name in Settings.`,
            });
        } else {
            const active = backend.status.activeState === "active";
            checks.push({
                id: "unit",
                label: "systemd unit",
                state: active ? "ok" : (backend.status.activeState === "failed" ? "error" : "warning"),
                detail: `${activeUnit}: ${backend.status.activeState} (${backend.status.subState}), ` +
                    `${backend.status.unitFileState || "no enablement state"}`,
            });
        }
    } else {
        checks.push({
            id: "unit",
            label: "systemd unit",
            state: "warning",
            detail: "No systemd unit configured for the selected backend.",
        });
    }

    const port = checkPort(sockets, config.port);
    if (port.listening) {
        checks.push(port.localhostOnly
            ? { id: "port", label: `VNC port ${config.port}`, state: "ok", detail: "Listening on loopback only" }
            : {
                id: "port",
                label: `VNC port ${config.port}`,
                state: "warning",
                detail: "Listening on non-loopback addresses. Traffic is tunneled through Cockpit — " +
                    "consider binding the VNC server to 127.0.0.1 only.",
            });
    } else {
        const serviceActive = backend.status?.activeState === "active";
        checks.push({
            id: "port",
            label: `VNC port ${config.port}`,
            state: serviceActive ? "error" : "warning",
            detail: serviceActive
                ? "The service is active but nothing listens on this port. Check the port in Settings."
                : "Nothing is listening (the service is not running).",
        });
    }

    if (backend.id === "x11vnc") {
        checks.push(session?.type === "x11"
            ? { id: "session", label: "Graphical session", state: "ok", detail: `X11 session on ${session.display ?? "unknown display"}` }
            : {
                id: "session",
                label: "Graphical session",
                state: "warning",
                detail: "No active X11 session — x11vnc needs a running Xorg session to mirror.",
            });
    } else if (backend.id === "wayvnc") {
        checks.push(session?.type === "wayland"
            ? { id: "session", label: "Graphical session", state: "ok", detail: `Wayland session (${session.desktop ?? "unknown compositor"})` }
            : { id: "session", label: "Graphical session", state: "warning", detail: "No active Wayland session detected." });
    }

    return checks;
}
