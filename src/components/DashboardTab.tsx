// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

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
import { _, format } from "../i18n";
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
        return <Loading text={_("Inspecting the system…")} />;

    if (error && backends === null)
        return <Alert variant="danger" isInline title={_("System inspection failed")}>{error}</Alert>;

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
            notify("success", format(_("Selected $0"), def.label), format(_("Managing $0"), unit));
        } catch (err) {
            notify("danger", _("Could not save the configuration"), toUserMessage(err));
        }
    };

    const selectedBackend = backends?.find(backend => backend.id === config.backend);
    const healthConfig = selectedBackend?.detectedPort
        ? { ...config, port: selectedBackend.detectedPort }
        : config;
    const checks = computeHealthChecks({
        transportAvailable: channelTransportAvailable(),
        config: healthConfig,
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
                    <CardTitle>{_("Health")}</CardTitle>
                    <CardBody>
                        <div className="ctr-health-actions">
                            <Button variant="secondary" icon={<SyncAltIcon />} onClick={() => refresh()}
                                    isLoading={loading} isDisabled={loading}>
                                {_("Refresh")}
                            </Button>
                            {session && (
                                <span className="ctr-session-summary">
                                    {_("Host graphical session:")} <strong>
                                        {session.type === "none" ? _("none") : session.type}
                                        {session.desktop ? ` (${session.desktop})` : ""}
                                    </strong>
                                </span>
                            )}
                        </div>
                        <HealthChecks checks={checks} />
                    </CardBody>
                </Card>
                <Card className="ctr-backends-panel">
                    <CardTitle>{_("Remote desktop backends")}</CardTitle>
                    <CardBody>
                        <p className="ctr-card-intro">
                            {_("Choose the backend Cockpit should manage. Service controls are shown only for the selected backend.")}
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
