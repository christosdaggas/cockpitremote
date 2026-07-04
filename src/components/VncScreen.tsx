import type { RefObject } from "react";
import {
    Button,
    EmptyState,
    EmptyStateActions,
    EmptyStateBody,
    EmptyStateFooter,
    EmptyStateHeader,
    EmptyStateIcon,
    Spinner,
} from "@patternfly/react-core";
import { DesktopIcon, ExclamationCircleIcon, PluggedIcon } from "@patternfly/react-icons";

import type { ConsoleState } from "../hooks/useRfb";

export interface VncScreenProps {
    containerRef: RefObject<HTMLDivElement>;
    state: ConsoleState;
    target: string;
    onConnect: () => void;
}

/*
 * The container div must stay mounted in every state — noVNC attaches its
 * canvas to it — so all state feedback is drawn on an overlay above it.
 */
export function VncScreen({ containerRef, state, target, onConnect }: VncScreenProps) {
    return (
        <div className="ctr-console">
            <div ref={containerRef} className="ctr-console-canvas" />
            {state.kind !== "connected" && (
                <div className="ctr-console-overlay">
                    {state.kind === "idle" && (
                        <EmptyState>
                            <EmptyStateHeader titleText="Remote desktop" headingLevel="h2"
                                              icon={<EmptyStateIcon icon={DesktopIcon} />} />
                            <EmptyStateBody>
                                Connect to the host&apos;s desktop at {target}. The connection is tunneled
                                through Cockpit — no extra ports, nothing to install locally.
                            </EmptyStateBody>
                            <EmptyStateFooter>
                                <EmptyStateActions>
                                    <Button variant="primary" onClick={onConnect}>Connect</Button>
                                </EmptyStateActions>
                            </EmptyStateFooter>
                        </EmptyState>
                    )}
                    {(state.kind === "connecting" || state.kind === "credentials") && (
                        <EmptyState>
                            <EmptyStateHeader titleText={state.kind === "credentials" ? "Waiting for credentials" : `Connecting to ${target}…`}
                                              headingLevel="h2"
                                              icon={<EmptyStateIcon icon={Spinner} />} />
                        </EmptyState>
                    )}
                    {state.kind === "error" && (
                        <EmptyState>
                            <EmptyStateHeader titleText="Connection failed" headingLevel="h2"
                                              icon={<EmptyStateIcon icon={ExclamationCircleIcon} />} />
                            <EmptyStateBody>{state.message}</EmptyStateBody>
                            <EmptyStateFooter>
                                <EmptyStateActions>
                                    <Button variant="primary" onClick={onConnect}>Retry</Button>
                                </EmptyStateActions>
                            </EmptyStateFooter>
                        </EmptyState>
                    )}
                    {state.kind === "disconnected" && (
                        <EmptyState>
                            <EmptyStateHeader titleText="Disconnected" headingLevel="h2"
                                              icon={<EmptyStateIcon icon={PluggedIcon} />} />
                            <EmptyStateBody>
                                {state.clean
                                    ? "The session was closed."
                                    : "The connection to the VNC server was lost."}
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
