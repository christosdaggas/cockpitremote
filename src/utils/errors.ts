/*
 * Maps cockpit.js failures (channel "problem" codes, spawn exit statuses) to
 * actionable user-facing messages. See
 * https://cockpit-project.org/guide/latest/cockpit-error for problem codes.
 */

export interface CockpitLikeError {
    message?: string;
    problem?: string | null;
    exit_status?: number | null;
}

function asCockpitError(err: unknown): CockpitLikeError {
    if (err && typeof err === "object")
        return err as CockpitLikeError;
    return { message: String(err) };
}

export function isNotFound(err: unknown): boolean {
    const e = asCockpitError(err);
    return e.problem === "not-found" || e.exit_status === 127;
}

export function isAccessDenied(err: unknown): boolean {
    const e = asCockpitError(err);
    return e.problem === "access-denied" || e.problem === "not-authorized" ||
        e.problem === "authentication-failed";
}

export function isCancelled(err: unknown): boolean {
    return asCockpitError(err).problem === "cancelled";
}

export function toUserMessage(err: unknown, context?: string): string {
    const e = asCockpitError(err);
    const prefix = context ? `${context}: ` : "";

    switch (e.problem) {
    case "access-denied":
    case "not-authorized":
        return `${prefix}Permission denied. Administrative access is required — ` +
            "use \"Turn on administrative access\" in the Cockpit toolbar and try again.";
    case "authentication-failed":
        return `${prefix}Authentication failed while requesting elevated privileges.`;
    case "not-found":
        return `${prefix}Command not found on this system.`;
    case "cancelled":
        return `${prefix}The operation was cancelled.`;
    case "timeout":
        return `${prefix}The operation timed out.`;
    case "terminated":
        return `${prefix}The process was terminated unexpectedly.`;
    case "disconnected":
        return `${prefix}Lost the connection to the host. Reload the page and try again.`;
    }

    if (e.exit_status === 127)
        return `${prefix}Command not found on this system.`;

    const detail = (e.message ?? "").trim();
    if (e.exit_status != null && e.exit_status !== 0) {
        return detail
            ? `${prefix}${detail} (exit code ${e.exit_status})`
            : `${prefix}Command failed with exit code ${e.exit_status}.`;
    }
    return detail ? `${prefix}${detail}` : `${prefix}An unexpected error occurred.`;
}
