import { useCallback, useRef } from "react";
import {
    Alert,
    Button,
    Card,
    CardBody,
    CardTitle,
    EmptyState,
    EmptyStateActions,
    EmptyStateBody,
    EmptyStateFooter,
    Stack,
    StackItem,
} from "@patternfly/react-core";
import { CogIcon } from "@patternfly/react-icons";

import { backendDef } from "../constants";
import { useGuacd } from "../hooks/useGuacd";
import type { BackendInfo, RemoteConfig, UiPrefs } from "../types";
import { ConsoleToolbar } from "./ConsoleToolbar";
import { GuacdCredentialsModal } from "./GuacdCredentialsModal";
import { GuacdScreen } from "./GuacdScreen";
import { Loading } from "./common/Loading";

export interface RemoteDesktopTabProps {
    config: RemoteConfig;
    /** Detection results; null while the first inspection is running. */
    backends: BackendInfo[] | null;
    prefs: UiPrefs;
    updatePrefs: (patch: Partial<UiPrefs>) => void;
    onGoToDashboard: () => void;
}

export function RemoteDesktopTab({ config, backends, prefs, updatePrefs, onGoToDashboard }: RemoteDesktopTabProps) {
    if (!config.backend) {
        return (
            <EmptyState titleText="No remote desktop backend selected" headingLevel="h2" icon={CogIcon}>
                <EmptyStateBody>
                    Pick a backend on the Dashboard (or configure one in Settings) before
                    connecting to the host&apos;s desktop.
                </EmptyStateBody>
                <EmptyStateFooter>
                    <EmptyStateActions>
                        <Button variant="primary" onClick={onGoToDashboard}>Go to Dashboard</Button>
                    </EmptyStateActions>
                </EmptyStateFooter>
            </EmptyState>
        );
    }

    if (backends === null)
        return <Loading text="Resolving the GNOME desktop-sharing endpoint…" />;

    const def = backendDef(config.backend);
    const info = backends.find(b => b.id === config.backend);
    // Both GNOME RDP daemons can listen at once, so the endpoint follows the
    // configured mode rather than whichever one detection happened to find.
    const detected = def.protocol === "rdp" && config.rdpMode === "remote-login"
        ? info?.remoteLoginPort
        : info?.detectedPort;
    const port = detected ?? config.port;
    const target = `${config.address}:${port}`;
    if (!def.manageable || info?.supported === false) {
        return (
            <Alert variant="info" isInline title={`${def.label} cannot be used for the console`}>
                {info?.notes.length ? info.notes.join(" ") : def.description}
            </Alert>
        );
    }

    // Connecting to the screen-sharing port while "Remote Login" is selected
    // would silently land in the wrong session, so say so instead.
    if (def.protocol === "rdp" && config.rdpMode === "remote-login" && !info?.remoteLoginPort) {
        return (
            <Alert variant="warning" isInline title="Remote Login is not enabled on this host">
                Settings selects GNOME&apos;s headless Remote Login, but the system
                gnome-remote-desktop daemon reports no enabled RDP endpoint. Enable it in
                GNOME Settings under Remote Desktop, or switch back to screen sharing in Settings.
            </Alert>
        );
    }

    return <GuacdConsole config={{ ...config, port }} prefs={prefs} updatePrefs={updatePrefs} target={target}
                         protocol={def.protocol} />;
}

function GuacdConsole({
    config,
    prefs,
    updatePrefs,
    target,
    protocol,
}: {
    config: RemoteConfig;
    prefs: UiPrefs;
    updatePrefs: (patch: Partial<UiPrefs>) => void;
    target: string;
    protocol: "rdp" | "vnc";
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const screenRef = useRef<HTMLDivElement>(null);
    const guacd = useGuacd(containerRef, prefs, protocol);

    const connect = useCallback(() => {
        guacd.connect(config.port, config.address);
    }, [guacd, config.port, config.address]);

    const fullscreen = useCallback(() => {
        screenRef.current?.requestFullscreen?.().catch(() => {
            // Fullscreen denied by the browser — nothing to clean up.
        });
    }, []);

    // guacd's quality and compression levels are VNC-only parameters; the RDP
    // client has no equivalent, so the controls would be inert there.
    const showEncodingPrefs = protocol === "vnc";

    return (
        <Card className="ctr-console-card">
            <CardTitle>Console</CardTitle>
            <CardBody>
                <Stack hasGutter>
                    <StackItem>
                        <ConsoleToolbar
                            state={guacd.state}
                            prefs={prefs}
                            updatePrefs={updatePrefs}
                            onConnect={connect}
                            onDisconnect={guacd.disconnect}
                            onCtrlAltDel={guacd.sendCtrlAltDel}
                            onFullscreen={fullscreen}
                            showEncodingPrefs={showEncodingPrefs}
                        />
                    </StackItem>
                    <StackItem>
                        <GuacdScreen screenRef={screenRef} containerRef={containerRef} state={guacd.state} target={target}
                                      protocol={protocol}
                                      onConnect={connect} />
                    </StackItem>
                </Stack>
                <GuacdCredentialsModal
                    protocol={protocol}
                    isOpen={guacd.state.kind === "credentials"}
                    onSubmit={guacd.sendCredentials}
                    onCancel={guacd.disconnect}
                />
            </CardBody>
        </Card>
    );
}
