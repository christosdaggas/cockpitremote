import { useCallback, useMemo, useState } from "react";
import {
    Alert,
    AlertActionCloseButton,
    AlertGroup,
    Page,
    PageSection,
    Tab,
    TabTitleText,
    Tabs,
} from "@patternfly/react-core";

import { backendDef } from "./constants";
import { useBackends } from "./hooks/useBackends";
import { useConfig, usePrefs } from "./hooks/useConfig";
import { NotifyContext, type NotifyFn, type NotifyVariant } from "./notifications";
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

export function App() {
    const { config, warning: configWarning, loading: configLoading, save } = useConfig();
    const [prefs, updatePrefs] = usePrefs();
    const backendsData = useBackends();
    const [activeTab, setActiveTab] = useState<string | number>("dashboard");
    const [toasts, setToasts] = useState<Toast[]>([]);

    const notify = useCallback<NotifyFn>((variant, title, detail) => {
        const key = ++toastCounter;
        setToasts(prev => [...prev.slice(-4), { key, variant, title, detail }]);
    }, []);

    const dismiss = useCallback((key: number) => {
        setToasts(prev => prev.filter(t => t.key !== key));
    }, []);

    // The unit the plugin manages: the configured one, or the backend default.
    const activeUnit = useMemo(() => {
        if (config.unit)
            return config.unit;
        if (!config.backend)
            return "";
        const detected = backendsData.backends?.find(b => b.id === config.backend)?.detectedUnit;
        return detected ?? backendDef(config.backend).defaultUnit;
    }, [config.unit, config.backend, backendsData.backends]);

    if (configLoading)
        return <Loading text="Loading configuration…" />;

    return (
        <NotifyContext.Provider value={notify}>
            <Page>
                <PageSection variant="light">
                    <h1 className="pf-v5-c-title pf-v5-m-2xl">Remote Desktop</h1>
                    <p className="pf-v5-u-color-200">
                        View and control this host&apos;s desktop from the browser. Traffic is tunneled
                        through Cockpit&apos;s encrypted session — no client software, no extra open ports.
                    </p>
                </PageSection>
                <PageSection>
                    {configWarning && (
                        <Alert variant="warning" isInline title={configWarning} className="pf-v5-u-mb-md" />
                    )}
                    <Tabs activeKey={activeTab} onSelect={(_event, key) => setActiveTab(key)}
                          aria-label="Remote desktop sections" role="region">
                        <Tab eventKey="dashboard" title={<TabTitleText>Dashboard</TabTitleText>}>
                            <div className="ctr-tab-panel">
                                <DashboardTab data={backendsData} config={config}
                                              activeUnit={activeUnit} saveConfig={save} />
                            </div>
                        </Tab>
                        <Tab eventKey="console" title={<TabTitleText>Remote desktop</TabTitleText>}>
                            <div className="ctr-tab-panel">
                                <RemoteDesktopTab config={config} prefs={prefs} updatePrefs={updatePrefs}
                                                  onGoToDashboard={() => setActiveTab("dashboard")} />
                            </div>
                        </Tab>
                        <Tab eventKey="settings" title={<TabTitleText>Settings</TabTitleText>}>
                            <div className="ctr-tab-panel">
                                <SettingsTab config={config} save={save} />
                            </div>
                        </Tab>
                        <Tab eventKey="logs" title={<TabTitleText>Logs</TabTitleText>}>
                            <div className="ctr-tab-panel">
                                <LogsTab unit={activeUnit} prefs={prefs} updatePrefs={updatePrefs}
                                         isActive={activeTab === "logs"} />
                            </div>
                        </Tab>
                    </Tabs>
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
