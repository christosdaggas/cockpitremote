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
});
