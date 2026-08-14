// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

import type { RefObject } from "react";
import {
    Button,
    EmptyState,
    EmptyStateActions,
    EmptyStateBody,
    EmptyStateFooter,
    Spinner,
} from "@patternfly/react-core";
import { DesktopIcon, ExclamationCircleIcon, PluggedIcon } from "@patternfly/react-icons";

import { _, format } from "../i18n";
import type { ConsoleState } from "../hooks/consoleState";

export interface GuacdScreenProps {
    screenRef: RefObject<HTMLDivElement>;
    containerRef: RefObject<HTMLDivElement>;
    state: ConsoleState;
    target: string;
    protocol?: "rdp" | "vnc";
    /** Mirrors the "Scale to fit" preference: when set, the box never scrolls. */
    scaleToFit?: boolean;
    onConnect: () => void;
}

export function GuacdScreen({
    screenRef,
    containerRef,
    state,
    target,
    protocol = "rdp",
    scaleToFit = true,
    onConnect,
}: GuacdScreenProps) {
    const label = protocol === "vnc" ? _("GNOME VNC") : _("GNOME RDP");
    const endpoint = protocol.toUpperCase();

    return (
        <div ref={screenRef} className="ctr-console">
            <div
                ref={containerRef}
                className={"ctr-console-canvas" +
                    (state.kind === "connected" ? " ctr-console-canvas-connected" : "") +
                    (scaleToFit ? " ctr-console-canvas-fit" : "")}
                tabIndex={0}
                role="application"
                aria-label={format(_("$0 remote desktop input"), endpoint)}
                onPointerDownCapture={event => event.currentTarget.focus({ preventScroll: true })}
            />
            {state.kind !== "connected" && (
                <div className="ctr-console-overlay">
                    {state.kind === "idle" && (
                        <EmptyState titleText={label} headingLevel="h2" icon={DesktopIcon}>
                            <EmptyStateBody>
                                {format(_("Connect to the host's $0 endpoint at $1. The browser talks to local guacd through Cockpit, then guacd connects to GNOME Remote Desktop."),
                                        endpoint, target)}
                            </EmptyStateBody>
                            <EmptyStateFooter>
                                <EmptyStateActions>
                                    <Button variant="primary" onClick={onConnect}>{_("Connect")}</Button>
                                </EmptyStateActions>
                            </EmptyStateFooter>
                        </EmptyState>
                    )}
                    {state.kind === "credentials" && (
                        <EmptyState titleText={format(_("$0 credentials required"), endpoint)}
                                    headingLevel="h2" icon={DesktopIcon}>
                            <EmptyStateBody>
                                {format(_("Enter the GNOME Remote Desktop $0 credentials to continue."), endpoint)}
                            </EmptyStateBody>
                        </EmptyState>
                    )}
                    {state.kind === "connecting" && (
                        <EmptyState titleText={format(_("Connecting to $0…"), target)}
                                    headingLevel="h2" icon={Spinner} />
                    )}
                    {state.kind === "error" && (
                        <EmptyState titleText={_("Connection failed")} headingLevel="h2" icon={ExclamationCircleIcon}>
                            <EmptyStateBody>{state.message}</EmptyStateBody>
                            <EmptyStateFooter>
                                <EmptyStateActions>
                                    <Button variant="primary" onClick={onConnect}>{_("Retry")}</Button>
                                </EmptyStateActions>
                            </EmptyStateFooter>
                        </EmptyState>
                    )}
                    {state.kind === "disconnected" && (
                        <EmptyState titleText={_("Disconnected")} headingLevel="h2" icon={PluggedIcon}>
                            <EmptyStateBody>
                                {state.clean
                                    ? _("The session was closed.")
                                    : format(_("The connection to the $0 server was lost."), endpoint)}
                            </EmptyStateBody>
                            <EmptyStateFooter>
                                <EmptyStateActions>
                                    <Button variant="primary" onClick={onConnect}>{_("Reconnect")}</Button>
                                </EmptyStateActions>
                            </EmptyStateFooter>
                        </EmptyState>
                    )}
                </div>
            )}
        </div>
    );
}
