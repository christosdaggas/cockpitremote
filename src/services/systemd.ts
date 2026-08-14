// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

import type { ServiceStatus, SystemdAction, UnitScope } from "../types";
import { parseKeyValueOutput } from "../utils/parse";
import { buildSystemctlActionArgs, buildSystemctlEnableNowArgs, buildSystemctlShowArgs } from "./commands";
import { spawn } from "./spawn";

/*
 * `systemctl show` exits 0 even for unknown units and reports
 * LoadState=not-found, which lets us distinguish "missing unit" from real
 * errors (permissions, missing systemctl, ...).
 *
 * User-scoped units (`systemctl --user`) must run as the logged-in Cockpit
 * user — never through the superuser bridge, where "--user" would address
 * root's (usually nonexistent) session manager instead.
 */
export async function getServiceStatus(unit: string, scope: UnitScope = "system"): Promise<ServiceStatus> {
    const output = await spawn(buildSystemctlShowArgs(unit, scope),
                               scope === "system" ? { superuser: "try" } : {});
    const props = parseKeyValueOutput(output);
    const execMainStatus = Number(props.ExecMainStatus);
    return {
        exists: props.LoadState !== "not-found" && props.LoadState !== undefined,
        loadState: props.LoadState ?? "unknown",
        activeState: props.ActiveState ?? "unknown",
        subState: props.SubState ?? "unknown",
        unitFileState: props.UnitFileState ?? "",
        execMainStatus: Number.isInteger(execMainStatus) ? execMainStatus : null,
    };
}

export async function serviceAction(action: SystemdAction, unit: string, scope: UnitScope = "system"): Promise<void> {
    await spawn(buildSystemctlActionArgs(action, unit, scope),
                scope === "system" ? { superuser: "require" } : {});
}

/** Enables and starts a required system service in one systemd transaction. */
export async function ensureSystemServiceStarted(unit: string): Promise<boolean> {
    const status = await getServiceStatus(unit);
    if (!status.exists)
        return false;
    if (status.activeState === "active" && status.unitFileState === "enabled")
        return true;

    await spawn(buildSystemctlEnableNowArgs(unit), { superuser: "require" });
    return true;
}
