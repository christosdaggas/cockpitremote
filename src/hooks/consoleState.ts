// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

export type ConsoleState =
    | { kind: "idle" }
    | { kind: "connecting" }
    | { kind: "credentials"; message: string | null }
    | { kind: "connected" }
    | { kind: "disconnected"; clean: boolean }
    | { kind: "error"; message: string };
