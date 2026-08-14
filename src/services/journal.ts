// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

import type { UnitScope } from "../types";
import { buildJournalArgs } from "./commands";
import { spawn } from "./spawn";

/*
 * User units log to the user's own journal; `journalctl --user` must run as
 * the logged-in user (see the scope note in systemd.ts).
 */
export async function fetchLogs(unit: string, lines: number, priority?: number | null, scope: UnitScope = "system"): Promise<string> {
    return await spawn(buildJournalArgs(unit, lines, priority, scope),
                       scope === "system" ? { superuser: "try" } : {});
}
