import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    AlertActionCloseButton,
    AlertGroup,
    Nav,
    NavItem,
    NavList,
    Page,
    PageSection,
} from "@patternfly/react-core";

import { backendDef, GUACD_UNIT } from "./constants";
import { _ } from "./i18n";
import { useBackends } from "./hooks/useBackends";
import { useConfig, usePrefs } from "./hooks/useConfig";
import { NotifyContext, type NotifyFn, type NotifyVariant } from "./notifications";
import { ensureSystemServiceStarted } from "./services/systemd";
import type { UnitScope } from "./types";
import { toUserMessage } from "./utils/errors";
import { DashboardTab } from "./components/DashboardTab";
import { LogsTab } from "./components/LogsTab";
import { RemoteDesktopTab } from "./components/RemoteDesktopTab";
import { SettingsTab } from "./components/SettingsTab";
import { Loading } from "./components/common/Loading";

interface Toast {
    key: number;
    variant: NotifyVariant;
    title: string;
    detail?: string;
}

let toastCounter = 0;

/*
 * Built at load, which is after the shell's po.js has run, so the labels come
 * out in the reader's language.
 */
const NAV_ITEMS = [
    { id: "dashboard", label: _("Dashboard"), description: _("Backend detection, service state, and connection health.") },
    { id: "console", label: _("Remote desktop"), description: _("Connect to the host desktop through Cockpit's authenticated session.") },
    { id: "settings", label: _("Settings"), description: _("Configure the remote desktop backend, target address, service unit, and passwords.") },
    { id: "logs", label: _("Logs"), description: _("Inspect recent journal entries for the configured remote desktop service.") },
] as const;

type TabId = typeof NAV_ITEMS[number]["id"];

export function App() {
    const { config, warning: configWarning, loading: configLoading, save } = useConfig();
    const [prefs, updatePrefs] = usePrefs();
    const backendsData = useBackends();
    const refreshBackends = backendsData.refresh;
    const [activeTab, setActiveTab] = useState<TabId>("dashboard");
    const [toasts, setToasts] = useState<Toast[]>([]);
    const guacdStartupAttempted = useRef(false);

    const notify = useCallback<NotifyFn>((variant, title, detail) => {
        const key = ++toastCounter;
        setToasts(prev => [...prev.slice(-4), { key, variant, title, detail }]);
    }, []);

    const dismiss = useCallback((key: number) => {
        setToasts(prev => prev.filter(t => t.key !== key));
    }, []);

    useEffect(() => {
        if (configLoading || guacdStartupAttempted.current)
            return;

        guacdStartupAttempted.current = true;
        ensureSystemServiceStarted(GUACD_UNIT).then(installed => {
            if (!installed)
                notify("warning", _("guacd is not installed"), _("Install guacd to use the browser remote desktop."));
            else
                refreshBackends();
        }).catch(err => {
            notify("danger", _("Could not start guacd"), toUserMessage(err));
        });
    }, [configLoading, notify, refreshBackends]);

    // The unit the plugin manages: the configured one, or the backend default.
    const activeUnit = useMemo(() => {
        if (config.unit)
            return config.unit;
        if (!config.backend)
            return "";
        const detected = backendsData.backends?.find(b => b.id === config.backend)?.detectedUnit;
        return detected ?? backendDef(config.backend).defaultUnit;
    }, [config.unit, config.backend, backendsData.backends]);

    // Remote Login is served by the system daemon of the same name, so logs and
    // service actions must follow the selected mode rather than the backend's
    // default (user) scope.
    const activeScope: UnitScope = config.backend
        ? (backendDef(config.backend).protocol === "rdp" && config.rdpMode === "remote-login"
            ? "system"
            : backendDef(config.backend).unitScope)
        : "system";
    const activeItem = NAV_ITEMS.find(item => item.id === activeTab) ?? NAV_ITEMS[0];

    if (configLoading)
        return <Loading text={_("Loading configuration…")} />;

    return (
        <NotifyContext.Provider value={notify}>
            <Page sidebar={null} className="ctr-page">
                <PageSection className="ctr-header" hasBodyWrapper={false}>
                    <Nav variant="horizontal-subnav" aria-label={_("Local")}>
                        <NavList>
                            {NAV_ITEMS.map(item => (
                                <NavItem
                                    key={item.id}
                                    itemId={item.id}
                                    isActive={activeTab === item.id}
                                    preventDefault
                                    onClick={(_event, itemId) => setActiveTab(itemId as TabId)}
                                >
                                    {item.label}
                                </NavItem>
                            ))}
                        </NavList>
                    </Nav>
                </PageSection>
                <PageSection className="ctr-page-main" hasBodyWrapper={false}>
                    <div className="ctr-page-heading">
                        <h1>{activeItem.label}</h1>
                        <p>{activeItem.description}</p>
                    </div>
                    {configWarning && (
                        <Alert variant="warning" isInline title={configWarning} className="ctr-page-alert" />
                    )}
                    <div hidden={activeTab !== "dashboard"}>
                        <DashboardTab data={backendsData} config={config}
                                      activeUnit={activeUnit} saveConfig={save} />
                    </div>
                    <div hidden={activeTab !== "console"}>
                        <RemoteDesktopTab config={config} backends={backendsData.backends}
                                          prefs={prefs} updatePrefs={updatePrefs}
                                          onGoToDashboard={() => setActiveTab("dashboard")} />
                    </div>
                    <div hidden={activeTab !== "settings"}>
                        <SettingsTab config={config} save={save} onRefresh={backendsData.refresh}
                                     backends={backendsData.backends} />
                    </div>
                    <div hidden={activeTab !== "logs"}>
                        <LogsTab unit={activeUnit} scope={activeScope} prefs={prefs}
                                 updatePrefs={updatePrefs} isActive={activeTab === "logs"} />
                    </div>
                </PageSection>
            </Page>
            <AlertGroup isToast isLiveRegion>
                {toasts.map(toast => (
                    <Alert
                        key={toast.key}
                        variant={toast.variant}
                        title={toast.title}
                        timeout={6000}
                        onTimeout={() => dismiss(toast.key)}
                        actionClose={<AlertActionCloseButton onClose={() => dismiss(toast.key)} />}
                    >
                        {toast.detail}
                    </Alert>
                ))}
            </AlertGroup>
        </NotifyContext.Provider>
    );
}
