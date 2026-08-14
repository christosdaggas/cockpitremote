// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCockpit = vi.hoisted((): { spawn: (args: string[]) => unknown } => ({
    spawn: () => undefined,
}));

vi.mock("../src/lib/cockpit", () => ({ default: mockCockpit }));

import { getVncScreenShareMode, setVncScreenShareMode } from "../src/services/screenshare";

/** Stands in for cockpit's spawn result: a thenable that also streams. */
function fakeProcess(output: string, ok = true) {
    const promise: Promise<string> = ok ? Promise.resolve(output) : Promise.reject(new Error("gsettings failed"));
    return Object.assign(promise, {
        stream(callback: (data: string) => void) {
            callback(output);
            return this;
        },
    });
}

/**
 * A dconf that may refuse to commit. gsettings exits 0 either way — the point
 * of the fake — so only the stored value tells the two apart.
 */
function installGsettings({ initial = "mirror-primary", commits = true } = {}) {
    let stored = initial;
    mockCockpit.spawn = (args: string[]) => {
        if (args[1] === "set") {
            if (commits)
                stored = args[4];
            return fakeProcess("");
        }
        return fakeProcess(`'${stored}'\n`);
    };
}

describe("getVncScreenShareMode", () => {
    beforeEach(() => installGsettings());

    it("unwraps the mode GNOME reports", async () => {
        await expect(getVncScreenShareMode()).resolves.toBe("mirror-primary");
    });

    it("reports null when the schema is missing", async () => {
        mockCockpit.spawn = () => fakeProcess("No such schema\n", false);
        await expect(getVncScreenShareMode()).resolves.toBeNull();
    });

    it("reports null for a value outside the enum this plugin knows", async () => {
        mockCockpit.spawn = () => fakeProcess("'something-new'\n");
        await expect(getVncScreenShareMode()).resolves.toBeNull();
    });
});

describe("setVncScreenShareMode", () => {
    it("stores the mode", async () => {
        installGsettings();
        await setVncScreenShareMode("extend");
        await expect(getVncScreenShareMode()).resolves.toBe("extend");
    });

    it("fails when dconf drops the write, which gsettings still exits 0 on", async () => {
        installGsettings({ commits: false });
        await expect(setVncScreenShareMode("extend")).rejects.toThrow(/did not store/);
    });
});
