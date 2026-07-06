/*
 * Two-tier persistence:
 *  - Machine config (backend/unit/port/...) lives in /etc/cockpit/
 *    cockpitremote.json so every admin session sees the same target.
 *  - Cosmetic per-user preferences live in localStorage.
 */

import cockpit from "../lib/cockpit";
import { CONFIG_PATH, DEFAULT_PREFS, BACKENDS } from "../constants";
import type { RemoteConfig, UiPrefs } from "../types";
import {
    validateAddress,
    validateGeometry,
    validatePort,
    validateUnitName,
    validateUsername,
} from "../utils/validation";

export const DEFAULT_CONFIG: RemoteConfig = {
    backend: null,
    unit: "",
    address: "127.0.0.1",
    port: 5900,
    geometry: "1280x800",
    vncUser: "",
};

function normalize(raw: unknown): RemoteConfig {
    const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const backend = BACKENDS.some(b => b.id === obj.backend) ? obj.backend as RemoteConfig["backend"] : null;
    return {
        backend,
        unit: typeof obj.unit === "string" ? obj.unit : "",
        address: typeof obj.address === "string" ? obj.address : DEFAULT_CONFIG.address,
        port: typeof obj.port === "number" && Number.isInteger(obj.port) ? obj.port : DEFAULT_CONFIG.port,
        geometry: typeof obj.geometry === "string" ? obj.geometry : DEFAULT_CONFIG.geometry,
        vncUser: typeof obj.vncUser === "string" ? obj.vncUser : "",
    };
}

export interface LoadedConfig {
    config: RemoteConfig;
    warning: string | null;
}

export async function loadConfig(): Promise<LoadedConfig> {
    let content: string | null;
    try {
        content = await cockpit.file(CONFIG_PATH, { superuser: "try" }).read();
    } catch (err) {
        return {
            config: DEFAULT_CONFIG,
            warning: `Could not read ${CONFIG_PATH}; using defaults. (${(err as Error).message ?? err})`,
        };
    }
    if (content === null || content.trim() === "")
        return { config: DEFAULT_CONFIG, warning: null };
    try {
        return { config: normalize(JSON.parse(content)), warning: null };
    } catch {
        return {
            config: DEFAULT_CONFIG,
            warning: `${CONFIG_PATH} contains invalid JSON; using defaults. Saving settings will overwrite it.`,
        };
    }
}

/** Validates every field, then writes atomically via cockpit.file().replace(). */
export async function saveConfig(config: RemoteConfig): Promise<void> {
    if (config.unit)
        validateUnitName(config.unit);
    validateAddress(config.address);
    validatePort(config.port);
    if (config.geometry)
        validateGeometry(config.geometry);
    if (config.vncUser)
        validateUsername(config.vncUser);
    const content = JSON.stringify(normalize(config), null, 2) + "\n";
    await cockpit.file(CONFIG_PATH, { superuser: "require" }).replace(content);
}

const PREFS_KEY = "cockpitremote:prefs";

export function loadPrefs(): UiPrefs {
    try {
        const raw = window.localStorage.getItem(PREFS_KEY);
        if (!raw)
            return { ...DEFAULT_PREFS };
        return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_PREFS };
    }
}

export function savePrefs(prefs: UiPrefs): void {
    try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
        // localStorage unavailable (private mode) — prefs just won't persist.
    }
}
