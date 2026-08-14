// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

import { describe, expect, it } from "vitest";

import { isAccessDenied, isCancelled, isNotFound, toUserMessage } from "../src/utils/errors";

describe("error classification", () => {
    it("recognizes missing commands", () => {
        expect(isNotFound({ problem: "not-found" })).toBe(true);
        expect(isNotFound({ exit_status: 127, message: "sh: exampled: not found" })).toBe(true);
        expect(isNotFound({ exit_status: 1 })).toBe(false);
    });

    it("recognizes permission problems", () => {
        expect(isAccessDenied({ problem: "access-denied" })).toBe(true);
        expect(isAccessDenied({ problem: "authentication-failed" })).toBe(true);
        expect(isAccessDenied({ problem: "timeout" })).toBe(false);
    });

    it("recognizes user cancellation", () => {
        expect(isCancelled({ problem: "cancelled" })).toBe(true);
        expect(isCancelled({ problem: null })).toBe(false);
        expect(isCancelled(new Error("x"))).toBe(false);
    });
});

describe("toUserMessage", () => {
    it("explains permission errors with the Cockpit escalation hint", () => {
        expect(toUserMessage({ problem: "access-denied" }, "Restart failed"))
            .toMatch(/administrative access/i);
    });

    it("includes stderr detail and exit codes", () => {
        expect(toUserMessage({ message: "Failed to start unit", exit_status: 5 }))
            .toBe("Failed to start unit (exit code 5)");
    });

    it("falls back to a generic message for empty errors", () => {
        expect(toUserMessage({})).toMatch(/unexpected error/i);
    });

    it("handles non-object errors", () => {
        expect(toUserMessage("boom")).toBe("boom");
    });

    it("maps disconnection to a reload hint", () => {
        expect(toUserMessage({ problem: "disconnected" })).toMatch(/reload/i);
    });
});
