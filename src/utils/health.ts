/*
 * Pure computation of the dashboard health checks from already-gathered
 * system facts — kept free of I/O so it is trivially unit-testable.
 */

import type { BackendInfo, HealthCheck, ListeningSocket, RemoteConfig, SessionInfo } from "../types";
import { GUACD_PORT } from "../constants";
import { checkPort } from "../services/network";

export interface HealthInput {
    transportAvailable: boolean;
    config: RemoteConfig;
    activeUnit: string;
    backends: BackendInfo[];
    session: SessionInfo | null;
    sockets: ListeningSocket[];
    /** The user this Cockpit session is logged in as, when known. */
    loginUser?: string | null;
}

export function computeHealthChecks(input: HealthInput): HealthCheck[] {
    const { transportAvailable, config, activeUnit, backends, session, sockets, loginUser } = input;
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
            label: "Remote desktop backend",
            state: "warning",
            detail: "No backend selected yet. Pick one on this page or in Settings.",
        });
        return checks;
    }

    checks.push(backend.binaryPath
        ? { id: "backend", label: "Remote desktop backend", state: "ok", detail: `${backend.label} (${backend.binaryPath})` }
        : { id: "backend", label: "Remote desktop backend", state: "error", detail: `${backend.label} is not installed.` });

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
    const protocolName = backend.protocol.toUpperCase();
    if (port.listening) {
        checks.push(port.localhostOnly
            ? { id: "port", label: `${protocolName} port ${config.port}`, state: "ok", detail: "Listening on loopback only" }
            : {
                id: "port",
                label: `${protocolName} port ${config.port}`,
                state: "warning",
                detail: backend.protocol === "vnc"
                    ? "Listening on non-loopback addresses. Traffic is tunneled through Cockpit — consider blocking outside access with a firewall rule."
                    : "Listening on non-loopback addresses. RDP clients can reach this port directly unless a firewall blocks it.",
            });
    } else {
        const serviceActive = backend.status?.activeState === "active";
        checks.push({
            id: "port",
            label: `${protocolName} port ${config.port}`,
            state: serviceActive ? "error" : "warning",
            detail: serviceActive
                ? "The service is active but nothing listens on this port. Check the port in Settings."
                : "Nothing is listening (the service is not running).",
        });
    }

    if (backend.id === "grd" || backend.id === "grd-rdp") {
        const guacd = checkPort(sockets, GUACD_PORT);
        if (guacd.listening) {
            checks.push(guacd.localhostOnly
                ? { id: "guacd", label: "guacd gateway", state: "ok", detail: `Listening on loopback port ${GUACD_PORT}` }
                : {
                    id: "guacd",
                    label: "guacd gateway",
                    state: "warning",
                    detail: `Listening beyond loopback on port ${GUACD_PORT}. Cockpit only needs local access to guacd.`,
                });
        } else {
            checks.push({
                id: "guacd",
                label: "guacd gateway",
                state: "error",
                detail: `guacd is not listening on port ${GUACD_PORT}. Install and start guacd for the browser console.`,
            });
        }
    }

    if (backend.id === "grd" || backend.id === "grd-rdp") {
        if (!session || (session.type !== "wayland" && session.type !== "x11")) {
            checks.push({
                id: "session",
                label: "Graphical session",
                state: "warning",
                detail: "GNOME Remote Desktop shares the active graphical session — someone must be logged into the desktop on the host.",
            });
        } else if (session.user && loginUser && session.user !== loginUser) {
            checks.push({
                id: "session",
                label: "Graphical session",
                state: "warning",
                detail: `The active desktop session belongs to "${session.user}", but this Cockpit session ` +
                    `is "${loginUser}". GNOME Remote Desktop is managed per user — the console reaches ` +
                    `the desktop user's session, and grdctl/service actions here affect "${loginUser}" only.`,
            });
        } else {
            checks.push({
                id: "session",
                label: "Graphical session",
                state: "ok",
                detail: `Active ${session.type} session${session.desktop ? ` (${session.desktop})` : ""}` +
                    `${session.user ? ` owned by ${session.user}` : ""}`,
            });
        }
    }

    return checks;
}
