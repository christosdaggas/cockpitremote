import { buildJournalArgs } from "./commands";
import { spawn } from "./spawn";

export async function fetchLogs(unit: string, lines: number, priority?: number | null): Promise<string> {
    return await spawn(buildJournalArgs(unit, lines, priority), { superuser: "try" });
}
