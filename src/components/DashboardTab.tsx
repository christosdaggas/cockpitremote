import {
    Alert,
    Button,
    Card,
    CardBody,
    CardTitle,
    Gallery,
} from "@patternfly/react-core";
import { SyncAltIcon } from "@patternfly/react-icons";

import { backendDef } from "../constants";
import type { BackendsData } from "../hooks/useBackends";
import { useNotify } from "../notifications";
import { channelTransportAvailable } from "../services/channel";
import type { BackendInfo, RemoteConfig } from "../types";
import { toUserMessage } from "../utils/errors";
import { computeHealthChecks } from "../utils/health";
import { HealthChecks } from "./HealthChecks";
import { BackendCard } from "./BackendCard";
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

    if (loading && backends === null)
        return <Loading text="Inspecting the system…" />;

    if (error && backends === null)
        return <Alert variant="danger" isInline title="System inspection failed">{error}</Alert>;

    const selectBackend = async (backend: BackendInfo) => {
        const def = backendDef(backend.id);
        const unit = backend.detectedUnit ?? def.defaultUnit;
        const next: RemoteConfig = {
            ...config,
            backend: backend.id,
            unit,
            port: backend.detectedPort ?? def.defaultPort,
        };
        try {
            await saveConfig(next);
            notify("success", `Selected ${def.label}`, `Managing ${unit}`);
        } catch (err) {
            notify("danger", "Could not save the configuration", toUserMessage(err));
        }
    };

    const checks = computeHealthChecks({
        transportAvailable: channelTransportAvailable(),
        config,
        activeUnit,
        backends: backends ?? [],
        session,
        sockets,
        loginUser,
    });
    const dashboardBackends = [...(backends ?? [])].sort((a, b) => {
        if (a.id === "grd")
            return -1;
        if (b.id === "grd")
            return 1;
        return 0;
    });

    return (
        <section className="ctr-dashboard">
            {error && <Alert variant="warning" isInline title={error} className="pf-v6-u-mb-md" />}
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
                    <CardTitle>Remote desktop backends</CardTitle>
                    <CardBody>
                        <p className="ctr-card-intro">
                            Choose the backend Cockpit should manage. Service controls are shown
                            only for the selected backend.
                        </p>
                        <div className="ctr-backends-grid">
                            {dashboardBackends.map(backend => (
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
    );
}
