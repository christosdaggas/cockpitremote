import { describe, expect, it } from "vitest";

import { resolveGrdRdpPort } from "../src/services/backends";
import type { GrdStatus } from "../src/utils/parse";

const status: GrdStatus = {
    hasRdp: true,
    rdpEnabled: true,
    rdpPort: 3389,
    rdpNegotiatePort: true,
    rdpViewOnly: false,
    rdpAuthMethods: "credentials",
    rdpPasswordEmpty: false,
    hasVnc: true,
    vncEnabled: true,
    vncPort: 5900,
    vncViewOnly: false,
    vncAuthMethod: "password",
    vncPasswordEmpty: false,
};

describe("resolveGrdRdpPort", () => {
    it("uses the negotiated port owned by the user's GNOME daemon", () => {
        expect(resolveGrdRdpPort(status, [
            { address: "*", port: 3389 },
            { address: "*", port: 3390, processes: ["gnome-remote-de"] },
            { address: "*", port: 5900, processes: ["gnome-remote-de"] },
        ])).toBe(3390);
    });

    it("uses the configured port when negotiation is disabled", () => {
        expect(resolveGrdRdpPort({ ...status, rdpNegotiatePort: false }, [
            { address: "*", port: 3390, processes: ["gnome-remote-de"] },
        ])).toBe(3389);
    });

    it("falls back safely when process ownership is unavailable", () => {
        expect(resolveGrdRdpPort(status, [{ address: "*", port: 3390 }])).toBe(3389);
    });
});
