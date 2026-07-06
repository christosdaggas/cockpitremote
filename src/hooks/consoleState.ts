export type ConsoleState =
    | { kind: "idle" }
    | { kind: "connecting" }
    | { kind: "credentials"; message: string | null }
    | { kind: "connected" }
    | { kind: "disconnected"; clean: boolean }
    | { kind: "error"; message: string };
