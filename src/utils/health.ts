/*
 * Pure computation of the dashboard health checks from already-gathered
 * system facts — kept free of I/O so it is trivially unit-testable.
 */

import type { BackendInfo, HealthCheck, ListeningSocket, RemoteConfig, SessionInfo } from "../types";
import { GUACD_PORT } from "../constants";
import { _, format } from "../i18n";
import { activeStateText } from "./labels";
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
        ? { id: "transport", label: _("Cockpit console transport"), state: "ok", detail: _("Available") }
        : {
            id: "transport",
            label: _("Cockpit console transport"),
            state: "error",
            detail: _("This Cockpit version does not expose the channel WebSocket API. Upgrade Cockpit."),
        });

    const backend = backends.find(b => b.id === config.backend);
    if (!backend) {
        checks.push({
            id: "backend",
            label: _("Remote desktop backend"),
            state: "warning",
            detail: _("No backend selected yet. Pick one on this page or in Settings."),
        });
        return checks;
    }

    checks.push(backend.binaryPath
        ? { id: "backend", label: _("Remote desktop backend"), state: "ok", detail: `${backend.label} (${backend.binaryPath})` }
        : { id: "backend", label: _("Remote desktop backend"), state: "error", detail: format(_("$0 is not installed."), backend.label) });

    if (activeUnit) {
        if (backend.status === null || backend.detectedUnit !== activeUnit) {
            checks.push({
                id: "unit",
                label: _("systemd unit"),
                state: "unknown",
                detail: format(_("$0 (state not inspected yet — refresh)"), activeUnit),
            });
        } else if (!backend.status.exists) {
            checks.push({
                id: "unit",
                label: _("systemd unit"),
                state: "error",
                detail: format(_("$0 was not found. Check the unit name in Settings."), activeUnit),
            });
        } else {
            const active = backend.status.activeState === "active";
            checks.push({
                id: "unit",
                label: _("systemd unit"),
                state: active ? "ok" : (backend.status.activeState === "failed" ? "error" : "warning"),
                detail: `${activeUnit}: ${activeStateText(backend.status.activeState)} (${backend.status.subState}), ` +
                    `${backend.status.unitFileState || _("no enablement state")}`,
            });
        }
    } else {
        checks.push({
            id: "unit",
            label: _("systemd unit"),
            state: "warning",
            detail: _("No systemd unit configured for the selected backend."),
        });
    }

    const port = checkPort(sockets, config.port);
    const protocolName = backend.protocol.toUpperCase();
    const portLabel = format(_("$0 port $1"), protocolName, config.port);
    if (port.listening) {
        checks.push(port.localhostOnly
            ? { id: "port", label: portLabel, state: "ok", detail: _("Listening on loopback only") }
            : {
                id: "port",
                label: portLabel,
                state: "warning",
                detail: backend.protocol === "vnc"
                    ? _("Listening on non-loopback addresses. Traffic is tunneled through Cockpit — consider blocking outside access with a firewall rule.")
                    : _("Listening on non-loopback addresses. RDP clients can reach this port directly unless a firewall blocks it."),
            });
    } else {
        const serviceActive = backend.status?.activeState === "active";
        checks.push({
            id: "port",
            label: portLabel,
            state: serviceActive ? "error" : "warning",
            detail: serviceActive
                ? _("The service is active but nothing listens on this port. Check the port in Settings.")
                : _("Nothing is listening (the service is not running)."),
        });
    }

    if (backend.id === "grd" || backend.id === "grd-rdp") {
        const guacd = checkPort(sockets, GUACD_PORT);
        if (guacd.listening) {
            checks.push(guacd.localhostOnly
                ? { id: "guacd", label: _("guacd gateway"), state: "ok", detail: format(_("Listening on loopback port $0"), GUACD_PORT) }
                : {
                    id: "guacd",
                    label: _("guacd gateway"),
                    state: "warning",
                    detail: format(_("Listening beyond loopback on port $0. Cockpit only needs local access to guacd."), GUACD_PORT),
                });
        } else {
            checks.push({
                id: "guacd",
                label: _("guacd gateway"),
                state: "error",
                detail: format(_("guacd is not listening on port $0. Install and start guacd for the browser console."), GUACD_PORT),
            });
        }
    }

    if (backend.id === "grd" || backend.id === "grd-rdp") {
        if (!session || (session.type !== "wayland" && session.type !== "x11")) {
            checks.push({
                id: "session",
                label: _("Graphical session"),
                state: "warning",
                detail: _("GNOME Remote Desktop shares the active graphical session — someone must be logged into the desktop on the host."),
            });
        } else if (session.user && loginUser && session.user !== loginUser) {
            checks.push({
                id: "session",
                label: _("Graphical session"),
                state: "warning",
                detail: format(_("The active desktop session belongs to \"$0\", but this Cockpit session is \"$1\". GNOME Remote Desktop is managed per user — the console reaches the desktop user's session, and grdctl/service actions here affect \"$1\" only."),
                               session.user, loginUser),
            });
        } else {
            checks.push({
                id: "session",
                label: _("Graphical session"),
                state: "ok",
                detail: format(_("Active $0 session"), session.type) +
                    (session.desktop ? ` (${session.desktop})` : "") +
                    (session.user ? format(_(" owned by $0"), session.user) : ""),
            });
        }
    }

    return checks;
}
