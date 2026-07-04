import { useCallback, useRef } from "react";
import {
    Alert,
    Button,
    EmptyState,
    EmptyStateActions,
    EmptyStateBody,
    EmptyStateFooter,
    EmptyStateHeader,
    EmptyStateIcon,
    Stack,
    StackItem,
} from "@patternfly/react-core";
import { CogIcon } from "@patternfly/react-icons";

import { backendDef } from "../constants";
import { useRfb } from "../hooks/useRfb";
import type { RemoteConfig, UiPrefs } from "../types";
import { ConsoleToolbar } from "./ConsoleToolbar";
import { CredentialsModal } from "./CredentialsModal";
import { VncScreen } from "./VncScreen";

export interface RemoteDesktopTabProps {
    config: RemoteConfig;
    prefs: UiPrefs;
    updatePrefs: (patch: Partial<UiPrefs>) => void;
    onGoToDashboard: () => void;
}

export function RemoteDesktopTab({ config, prefs, updatePrefs, onGoToDashboard }: RemoteDesktopTabProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rfb = useRfb(containerRef, prefs);

    const connect = useCallback(() => {
        rfb.connect(config.port, config.address);
    }, [rfb, config.port, config.address]);

    const fullscreen = useCallback(() => {
        containerRef.current?.requestFullscreen?.().catch(() => {
            // Fullscreen denied by the browser — nothing to clean up.
        });
    }, []);

    if (!config.backend) {
        return (
            <EmptyState>
                <EmptyStateHeader titleText="No VNC backend selected" headingLevel="h2"
                                  icon={<EmptyStateIcon icon={CogIcon} />} />
                <EmptyStateBody>
                    Pick a VNC backend on the Dashboard (or configure one in Settings) before
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

    const def = backendDef(config.backend);
    const target = `${config.address}:${config.port}`;

    if (!def.manageable) {
        return (
            <Alert variant="info" isInline title={`${def.label} cannot be used for the console`}>
                {def.description}
            </Alert>
        );
    }

    return (
        <Stack hasGutter>
            <StackItem>
                <ConsoleToolbar
                    state={rfb.state}
                    prefs={prefs}
                    updatePrefs={updatePrefs}
                    onConnect={connect}
                    onDisconnect={rfb.disconnect}
                    onCtrlAltDel={rfb.sendCtrlAltDel}
                    onFullscreen={fullscreen}
                />
            </StackItem>
            <StackItem>
                <VncScreen containerRef={containerRef} state={rfb.state} target={target}
                           onConnect={connect} />
            </StackItem>
            <CredentialsModal
                isOpen={rfb.state.kind === "credentials"}
                message={rfb.state.kind === "credentials" ? rfb.state.message : null}
                onSubmit={rfb.sendCredentials}
                onCancel={rfb.disconnect}
            />
        </Stack>
    );
}
