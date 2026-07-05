import { useCallback, useMemo, useState } from "react";
import {
    Alert,
    AlertActionCloseButton,
    AlertGroup,
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

    const activeScope = config.backend ? backendDef(config.backend).unitScope : "system";

    if (configLoading)
        return <Loading text="Loading configuration…" />;

    return (
        <NotifyContext.Provider value={notify}>
            <div className="ctr-page">
                <header className="ctr-page-header">
                    <Tabs activeKey={activeTab} onSelect={(_event, key) => setActiveTab(key)}
                          className="ctr-page-tabs" aria-label="Remote desktop sections">
                        <Tab eventKey="dashboard" title={<TabTitleText>Dashboard</TabTitleText>} />
                        <Tab eventKey="console" title={<TabTitleText>Remote desktop</TabTitleText>} />
                        <Tab eventKey="settings" title={<TabTitleText>Settings</TabTitleText>} />
                        <Tab eventKey="logs" title={<TabTitleText>Logs</TabTitleText>} />
                    </Tabs>
                </header>
                <main className="ctr-page-main">
                    {configWarning && (
                        <Alert variant="warning" isInline title={configWarning} className="pf-v5-u-mb-md" />
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
                        <SettingsTab config={config} save={save} backends={backendsData.backends} />
                    </div>
                    <div hidden={activeTab !== "logs"}>
                        <LogsTab unit={activeUnit} scope={activeScope} prefs={prefs}
                                 updatePrefs={updatePrefs} isActive={activeTab === "logs"} />
                    </div>
                </main>
            </div>
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
