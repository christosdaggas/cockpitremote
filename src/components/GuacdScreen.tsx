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

import type { ConsoleState } from "../hooks/consoleState";

export interface GuacdScreenProps {
    screenRef: RefObject<HTMLDivElement>;
    containerRef: RefObject<HTMLDivElement>;
    state: ConsoleState;
    target: string;
    protocol?: "rdp" | "vnc";
    onConnect: () => void;
}

export function GuacdScreen({ screenRef, containerRef, state, target, protocol = "rdp", onConnect }: GuacdScreenProps) {
    const label = protocol === "vnc" ? "GNOME VNC" : "GNOME RDP";
    const endpoint = protocol.toUpperCase();

    return (
        <div ref={screenRef} className="ctr-console">
            <div ref={containerRef} className="ctr-console-canvas" />
            {state.kind !== "connected" && (
                <div className="ctr-console-overlay">
                    {state.kind === "idle" && (
                        <EmptyState titleText={label} headingLevel="h2" icon={DesktopIcon}>
                            <EmptyStateBody>
                                Connect to the host&apos;s {endpoint} endpoint at {target}. The browser talks to
                                local guacd through Cockpit, then guacd connects to GNOME Remote Desktop.
                            </EmptyStateBody>
                            <EmptyStateFooter>
                                <EmptyStateActions>
                                    <Button variant="primary" onClick={onConnect}>Connect</Button>
                                </EmptyStateActions>
                            </EmptyStateFooter>
                        </EmptyState>
                    )}
                    {state.kind === "credentials" && (
                        <EmptyState titleText={`${endpoint} credentials required`} headingLevel="h2" icon={DesktopIcon}>
                            <EmptyStateBody>
                                Enter the GNOME Remote Desktop {endpoint} credentials to continue.
                            </EmptyStateBody>
                        </EmptyState>
                    )}
                    {state.kind === "connecting" && (
                        <EmptyState titleText={`Connecting to ${target}…`} headingLevel="h2" icon={Spinner} />
                    )}
                    {state.kind === "error" && (
                        <EmptyState titleText="Connection failed" headingLevel="h2" icon={ExclamationCircleIcon}>
                            <EmptyStateBody>{state.message}</EmptyStateBody>
                            <EmptyStateFooter>
                                <EmptyStateActions>
                                    <Button variant="primary" onClick={onConnect}>Retry</Button>
                                </EmptyStateActions>
                            </EmptyStateFooter>
                        </EmptyState>
                    )}
                    {state.kind === "disconnected" && (
                        <EmptyState titleText="Disconnected" headingLevel="h2" icon={PluggedIcon}>
                            <EmptyStateBody>
                                {state.clean
                                    ? "The session was closed."
                                    : `The connection to the ${endpoint} server was lost.`}
                            </EmptyStateBody>
                            <EmptyStateFooter>
                                <EmptyStateActions>
                                    <Button variant="primary" onClick={onConnect}>Reconnect</Button>
                                </EmptyStateActions>
                            </EmptyStateFooter>
                        </EmptyState>
                    )}
                </div>
            )}
        </div>
    );
}
