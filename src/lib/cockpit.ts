/*
 * Typed access to the cockpit.js API. cockpit.js is provided at runtime by the
 * Cockpit shell (loaded from ../base1/cockpit.js in index.html) and is never
 * bundled. Importing through this module keeps the rest of the code testable:
 * unit tests mock this module instead of a window global.
 */

export interface SpawnOptions {
    superuser?: "try" | "require";
    err?: "message" | "out" | "ignore" | "pty";
    binary?: boolean;
    environ?: string[];
    directory?: string;
    pty?: boolean;
}

export interface SpawnError {
    message: string;
    problem?: string | null;
    exit_status?: number | null;
    exit_signal?: number | null;
}

export interface SpawnProcess<T = string> extends Promise<T> {
    input(data: string | Uint8Array | null, stream?: boolean): SpawnProcess<T>;
    stream(callback: (data: T) => void): SpawnProcess<T>;
    close(problem?: string): void;
}

export interface FileHandle<T = string> {
    path: string;
    read(): Promise<T | null>;
    replace(content: T | null): Promise<string | null>;
    modify(callback: (data: T | null) => T | null): Promise<T | null>;
    watch(callback: (data: T | null, tag: string | null, error?: unknown) => void): { remove(): void };
    close(): void;
}

export interface FileOptions {
    binary?: boolean;
    superuser?: "try" | "require";
    max_read_size?: number;
}

export interface Transport {
    csrf_token: string;
    host: string | null;
    uri(suffix?: string): string;
    application(): string;
    close(problem?: string): void;
}

export interface UserInfo {
    name: string;
    full_name: string;
    home: string;
    shell: string;
    groups: string[];
}

export interface Cockpit {
    spawn(args: string[], options?: SpawnOptions & { binary?: false | undefined }): SpawnProcess<string>;
    spawn(args: string[], options: SpawnOptions & { binary: true }): SpawnProcess<Uint8Array>;
    file(path: string, options?: FileOptions & { binary?: false | undefined }): FileHandle<string>;
    file(path: string, options: FileOptions & { binary: true }): FileHandle<Uint8Array>;
    user(): Promise<UserInfo>;
    transport?: Transport;
    gettext(text: string): string;
    /** Substitutes $0, $1, … in a (usually translated) template. */
    format(template: string, ...args: unknown[]): string;
    /** The locale Cockpit resolved for this session, e.g. "de" or "pt-br". */
    language?: string;
}

const cockpit: Cockpit =
    (typeof window !== "undefined" ? (window as unknown as { cockpit?: Cockpit }).cockpit : undefined) as Cockpit;

export default cockpit;
