import { useEffect, useState } from "react";
import {
    Alert,
    Button,
    Card,
    CardBody,
    CardTitle,
    Gallery,
    Stack,
    StackItem,
} from "@patternfly/react-core";
import { SyncAltIcon } from "@patternfly/react-icons";

import { backendDef } from "../constants";
import type { BackendsData } from "../hooks/useBackends";
import { useNotify } from "../notifications";
import { getOsInfo } from "../services/osinfo";
import { channelTransportAvailable } from "../services/channel";
import type { BackendInfo, OsInfo, RemoteConfig } from "../types";
import { toUserMessage } from "../utils/errors";
import { computeHealthChecks } from "../utils/health";
import { displayFromUnit, portForDisplay } from "../utils/validation";
import { HealthChecks } from "./HealthChecks";
import { BackendCard } from "./BackendCard";
import { SetupGuide } from "./SetupGuide";
import { Loading } from "./common/Loading";

export interface DashboardTabProps {
    data: BackendsData;
    config: RemoteConfig;
    activeUnit: string;
    saveConfig: (next: RemoteConfig) => Promise<void>;
}

export function DashboardTab({ data, config, activeUnit, saveConfig }: DashboardTabProps) {
    const notify = useNotify();
    const { backends, session, sockets, loginUser, loading, error, refresh } = data;
    const [os, setOs] = useState<OsInfo | null>(null);

    useEffect(() => {
        getOsInfo().then(setOs).catch(() => setOs(null));
    }, []);

    if (loading && backends === null)
        return <Loading text="Inspecting the system…" />;

    if (error && backends === null)
        return <Alert variant="danger" isInline title="System inspection failed">{error}</Alert>;

    const selectBackend = async (backend: BackendInfo) => {
        const def = backendDef(backend.id);
        const unit = backend.detectedUnit ?? def.defaultUnit;
        const display = displayFromUnit(unit);
        const next: RemoteConfig = {
            ...config,
            backend: backend.id,
            unit,
            port: display !== null ? portForDisplay(display) : (backend.detectedPort ?? def.defaultPort),
        };
        try {
            await saveConfig(next);
            notify("success", `Selected ${def.label}`, `Managing ${unit}`);
        } catch (err) {
            notify("danger", "Could not save the configuration", toUserMessage(err));
        }
    };

    const anyInstalled = (backends ?? []).some(b => b.binaryPath !== null && b.supported);
    const checks = computeHealthChecks({
        transportAvailable: channelTransportAvailable(),
        config,
        activeUnit,
        backends: backends ?? [],
        session,
        sockets,
        loginUser,
    });

    return (
        <Stack hasGutter className="ctr-dashboard">
            <StackItem>
                <section className="ctr-dashboard-panel">
                    {error && <Alert variant="warning" isInline title={error} className="pf-v5-u-mb-md" />}
                    <Gallery hasGutter minWidths={{ default: "320px" }} className="ctr-dashboard-gallery">
                        <Card className="ctr-health-card">
                            <CardTitle>Health</CardTitle>
                            <CardBody>
                                <div className="ctr-health-actions">
                                    <Button variant="secondary" icon={<SyncAltIcon />} onClick={() => refresh()}
                                            isLoading={loading} isDisabled={loading}>
                                        Refresh
                                    </Button>
                                    {session && (
                                        <span className="ctr-session-summary">
                                            Host graphical session: <strong>
                                                {session.type === "none" ? "none" : session.type}
                                                {session.desktop ? ` (${session.desktop})` : ""}
                                            </strong>
                                        </span>
                                    )}
                                </div>
                                <HealthChecks checks={checks} />
                            </CardBody>
                        </Card>
                        <Card className="ctr-backends-panel">
                            <CardTitle>VNC backends</CardTitle>
                            <CardBody>
                                <div className="ctr-backends-grid">
                                    {(backends ?? []).map(backend => (
                                        <BackendCard
                                            key={backend.id}
                                            backend={backend}
                                            isSelected={config.backend === backend.id}
                                            activeUnit={config.backend === backend.id ? activeUnit : null}
                                            onSelect={selectBackend}
                                            onRefresh={refresh}
                                        />
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                    </Gallery>
                </section>
            </StackItem>

            <StackItem>
                <SetupGuide os={os} backends={backends ?? []} onRefresh={refresh}
                            defaultExpanded={!anyInstalled} />
            </StackItem>
        </Stack>
    );
}
