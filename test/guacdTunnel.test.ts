import { describe, expect, it } from "vitest";

import { buildGuacdConnectArgs, encodeInstruction, type GuacdConnectionOptions } from "../src/services/guacdTunnel";

const options: GuacdConnectionOptions = {
    protocol: "rdp",
    hostname: "127.0.0.1",
    port: 3389,
    username: "alice",
    password: "secret",
    domain: "WORKGROUP",
    width: 1280,
    height: 800,
    dpi: 96,
    timezone: "Europe/Athens",
};

describe("guacd tunnel helpers", () => {
    it("encodes Guacamole protocol instructions", () => {
        expect(encodeInstruction("select", "rdp")).toBe("6.select,3.rdp;");
        expect(encodeInstruction("connect", "a,b;c")).toBe("7.connect,5.a,b;c;");
    });

    // guacd parses the "pressed" flag with strtol(); "true"/"false" both read
    // as 0, which would turn every key press into a release.
    it("encodes booleans as 1/0 rather than \"true\"/\"false\"", () => {
        expect(encodeInstruction("key", 65, true)).toBe("3.key,2.65,1.1;");
        expect(encodeInstruction("key", 65, false)).toBe("3.key,2.65,1.0;");
    });

    it("leaves string connect arguments untouched", () => {
        expect(encodeInstruction("connect", "true", "false")).toBe("7.connect,4.true,5.false;");
    });

    it("maps guacd RDP argument names to connection values", () => {
        expect(buildGuacdConnectArgs([
            "VERSION_1_5_0",
            "hostname",
            "port",
            "username",
            "password",
            "domain",
            "width",
            "height",
            "dpi",
            "timezone",
            "security",
            "ignore-cert",
            "resize-method",
            "unknown-new-argument",
        ], options)).toEqual([
            "VERSION_1_5_0",
            "127.0.0.1",
            "3389",
            "alice",
            "secret",
            "WORKGROUP",
            "1280",
            "800",
            "96",
            "Europe/Athens",
            "any",
            "true",
            "display-update",
            "",
        ]);
    });

    it("maps guacd VNC argument names to connection values", () => {
        expect(buildGuacdConnectArgs([
            "VERSION_1_5_0",
            "hostname",
            "port",
            "username",
            "password",
            "read-only",
            "color-depth",
            "cursor",
            "unknown-new-argument",
        ], { ...options, protocol: "vnc", port: 5900, username: "" })).toEqual([
            "VERSION_1_5_0",
            "127.0.0.1",
            "5900",
            "",
            "secret",
            "false",
            "32",
            "local",
            "",
        ]);
    });

    it("passes VNC quality and compression levels through, clamped", () => {
        const vnc = { ...options, protocol: "vnc" as const };
        const names = ["quality-level", "compress-level"];
        expect(buildGuacdConnectArgs(names, vnc)).toEqual(["6", "2"]);
        expect(buildGuacdConnectArgs(names, { ...vnc, qualityLevel: 9, compressionLevel: 0 }))
                .toEqual(["9", "0"]);
        // Out-of-range and non-integer values must not reach guacd.
        expect(buildGuacdConnectArgs(names, { ...vnc, qualityLevel: 42, compressionLevel: -3 }))
                .toEqual(["9", "0"]);
        expect(buildGuacdConnectArgs(names, { ...vnc, qualityLevel: 1.5, compressionLevel: NaN }))
                .toEqual(["6", "2"]);
    });

    it("leaves the guacd clipboard enabled in both directions", () => {
        for (const protocol of ["rdp", "vnc"] as const) {
            expect(buildGuacdConnectArgs(["disable-copy", "disable-paste"], { ...options, protocol }))
                    .toEqual(["false", "false"]);
        }
    });
});
