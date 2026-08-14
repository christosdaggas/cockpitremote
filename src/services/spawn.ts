// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

/*
 * Thin helpers around cockpit.spawn(). All spawns force LC_ALL=C so parsers
 * see stable, locale-independent output.
 */

import cockpit, { type SpawnOptions } from "../lib/cockpit";

const BASE_ENV = ["LC_ALL=C"];

/** Text-mode options only; binary spawns call cockpit.spawn() directly. */
export type TextSpawnOptions = Omit<SpawnOptions, "binary">;

export function spawn(args: string[], options: TextSpawnOptions = {}): Promise<string> {
    return cockpit.spawn(args, {
        err: "message",
        ...options,
        environ: [...BASE_ENV, ...(options.environ ?? [])],
    });
}

/**
 * Runs a command whose failure is expected/normal (probes). Collects stdout
 * (and stderr when err:"out") even on non-zero exit, and never rejects.
 */
export function probe(args: string[], options: TextSpawnOptions = {}): Promise<{ ok: boolean; output: string }> {
    return new Promise(resolve => {
        let output = "";
        const proc = cockpit.spawn(args, {
            err: "out",
            ...options,
            environ: [...BASE_ENV, ...(options.environ ?? [])],
        });
        proc.stream(data => { output += data });
        proc.then(() => resolve({ ok: true, output }))
            .catch(() => resolve({ ok: false, output }));
    });
}
