// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

import type { SessionInfo } from "../types";
import { parseKeyValueOutput, parseSessionIds } from "../utils/parse";
import { buildLoginctlListArgs, buildLoginctlShowSessionArgs } from "./commands";
import { probe, spawn } from "./spawn";

/*
 * Finds the active graphical login session, if any. `loginctl list-sessions`
 * column layout varies across systemd versions, so only the first column
 * (session id) is taken from it; details come from the stable
 * `show-session --property=...` key/value output.
 */
export async function getSessionInfo(): Promise<SessionInfo> {
    let ids: string[];
    try {
        ids = parseSessionIds(await spawn(buildLoginctlListArgs(), { superuser: "try" }));
    } catch {
        return { type: "none", desktop: null, display: null, user: null };
    }

    let sawActive = false;
    for (const id of ids) {
        const { ok, output } = await probe(buildLoginctlShowSessionArgs(id), { superuser: "try" });
        if (!ok)
            continue;
        const props = parseKeyValueOutput(output);
        if (props.Active !== "yes")
            continue;
        sawActive = true;
        if (props.Type === "x11" || props.Type === "wayland") {
            return {
                type: props.Type,
                desktop: props.Desktop || null,
                display: props.Display || null,
                user: props.Name || null,
            };
        }
    }
    return { type: sawActive ? "tty" : "none", desktop: null, display: null, user: null };
}
