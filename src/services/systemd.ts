import type { ServiceStatus, SystemdAction } from "../types";
import { parseKeyValueOutput } from "../utils/parse";
import { buildSystemctlActionArgs, buildSystemctlShowArgs } from "./commands";
import { spawn } from "./spawn";

/*
 * `systemctl show` exits 0 even for unknown units and reports
 * LoadState=not-found, which lets us distinguish "missing unit" from real
 * errors (permissions, missing systemctl, ...).
 */
export async function getServiceStatus(unit: string): Promise<ServiceStatus> {
    const output = await spawn(buildSystemctlShowArgs(unit), { superuser: "try" });
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

export async function serviceAction(action: SystemdAction, unit: string): Promise<void> {
    await spawn(buildSystemctlActionArgs(action, unit), { superuser: "require" });
}
