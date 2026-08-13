import type { ListeningSocket } from "../types";
import { parseSsListening } from "../utils/parse";
import { isLoopback } from "../utils/validation";
import { buildSsListeningArgs, buildSsListeningProcessArgs } from "./commands";
import { spawn } from "./spawn";

export async function getListeningSockets(): Promise<ListeningSocket[]> {
    const output = await spawn(buildSsListeningArgs(), { superuser: "try" });
    return parseSsListening(output);
}

export async function getListeningProcessSockets(): Promise<ListeningSocket[]> {
    // Do not elevate: process names visible to this user distinguish the user's
    // desktop-sharing daemon from the system-wide GDM Remote Login daemon.
    return parseSsListening(await spawn(buildSsListeningProcessArgs()));
}

export interface PortCheck {
    listening: boolean;
    localhostOnly: boolean;
}

export function checkPort(sockets: ListeningSocket[], port: number): PortCheck {
    const matches = sockets.filter(s => s.port === port);
    return {
        listening: matches.length > 0,
        localhostOnly: matches.length > 0 &&
            matches.every(s => isLoopback(s.address) || s.address === "::1"),
    };
}
