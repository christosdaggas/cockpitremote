import { useCallback, useEffect, useState } from "react";

import { DEFAULT_CONFIG, loadConfig, loadPrefs, saveConfig, savePrefs } from "../services/config";
import type { RemoteConfig, UiPrefs } from "../types";

export interface ConfigData {
    config: RemoteConfig;
    warning: string | null;
    loading: boolean;
    save: (next: RemoteConfig) => Promise<void>;
}

export function useConfig(): ConfigData {
    const [config, setConfig] = useState<RemoteConfig>(DEFAULT_CONFIG);
    const [warning, setWarning] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        loadConfig().then(({ config: loaded, warning: w }) => {
            if (!cancelled) {
                setConfig(loaded);
                setWarning(w);
            }
        }).finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const save = useCallback(async (next: RemoteConfig) => {
        await saveConfig(next);
        setConfig(next);
    }, []);

    return { config, warning, loading, save };
}

export function usePrefs(): [UiPrefs, (patch: Partial<UiPrefs>) => void] {
    const [prefs, setPrefs] = useState<UiPrefs>(loadPrefs);
    const update = useCallback((patch: Partial<UiPrefs>) => {
        setPrefs(prev => {
            const next = { ...prev, ...patch };
            savePrefs(next);
            return next;
        });
    }, []);
    return [prefs, update];
}
