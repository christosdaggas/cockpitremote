import { describe, expect, it } from "vitest";

import {
    ValidationError,
    displayFromUnit,
    isLoopback,
    portForDisplay,
    portWarning,
    validateAddress,
    validateGeometry,
    validatePassword,
    validatePath,
    validatePort,
    validateUnitName,
    validateUsername,
} from "../src/utils/validation";

/* Inputs that must never survive validation anywhere. */
const INJECTION_CORPUS = [
    "foo.service; rm -rf /",
    "$(reboot).service",
    "`reboot`.service",
    "foo.service && reboot",
    "foo.service|cat /etc/shadow",
    "-r.service",
    "--now.service",
    "a b.service",
    "foo.service\n",
    "\nfoo.service",
    "foo.service\x00",
    "фу.service",
    "foo.service ",
    " foo.service",
    "",
];

describe("validateUnitName", () => {
    it.each([
        "vncserver@:1.service",
        "x11vnc.service",
        "wayvnc.service",
        "gnome-remote-desktop.service",
        "my_custom-unit.2.service",
    ])("accepts %s", unit => {
        expect(validateUnitName(unit)).toBe(unit);
    });

    it.each(INJECTION_CORPUS)("rejects %j", input => {
        expect(() => validateUnitName(input)).toThrow(ValidationError);
    });

    it("rejects non-service units", () => {
        expect(() => validateUnitName("foo.socket")).toThrow(ValidationError);
        expect(() => validateUnitName("foo")).toThrow(ValidationError);
    });

    it("rejects overlong names", () => {
        expect(() => validateUnitName("a".repeat(300) + ".service")).toThrow(ValidationError);
    });
});

describe("validatePort", () => {
    it("accepts the full TCP range", () => {
        expect(validatePort(1)).toBe(1);
        expect(validatePort(5901)).toBe(5901);
        expect(validatePort(65535)).toBe(65535);
    });

    it.each([0, -1, 65536, 1.5, NaN, Infinity])("rejects %s", port => {
        expect(() => validatePort(port as number)).toThrow(ValidationError);
    });

    it("advises on unconventional ports without blocking them", () => {
        expect(portWarning(5901)).toBeNull();
        expect(portWarning(8080)).toMatch(/5900-5999/);
    });
});

describe("validateAddress", () => {
    it.each(["127.0.0.1", "localhost", "192.168.1.10"])("accepts %s", addr => {
        expect(validateAddress(addr)).toBe(addr);
    });

    it.each(["evil.example.com", "127.0.0.1; reboot", "999.1.1.1", "::1", "", "127.0.0.1 "])(
        "rejects %j", addr => {
            expect(() => validateAddress(addr)).toThrow(ValidationError);
        });

    it("classifies loopback addresses", () => {
        expect(isLoopback("127.0.0.1")).toBe(true);
        expect(isLoopback("localhost")).toBe(true);
        expect(isLoopback("192.168.1.10")).toBe(false);
    });
});

describe("validateGeometry", () => {
    it("accepts sane resolutions", () => {
        expect(validateGeometry("1280x800")).toBe("1280x800");
        expect(validateGeometry("3840x2160")).toBe("3840x2160");
    });

    it.each(["800", "800x", "x600", "99x99", "100000x100", "800 x 600", "800x600; reboot"])(
        "rejects %j", geometry => {
            expect(() => validateGeometry(geometry)).toThrow(ValidationError);
        });
});

describe("validateUsername", () => {
    it.each(["alice", "web-admin", "_svc", "a"])("accepts %s", user => {
        expect(validateUsername(user)).toBe(user);
    });

    it.each(["root;reboot", "Alice", "-alice", "alice bob", "", "alice\n", "../../etc"])(
        "rejects %j", user => {
            expect(() => validateUsername(user)).toThrow(ValidationError);
        });
});

describe("validatePath", () => {
    it("accepts safe absolute paths", () => {
        expect(validatePath("/etc/cockpitremote/x11vnc.passwd")).toBe("/etc/cockpitremote/x11vnc.passwd");
        expect(validatePath("/home/alice/.vnc")).toBe("/home/alice/.vnc");
    });

    it.each(["relative/path", "/tmp/../etc/shadow", "/tmp/-rf", "/tmp/a b", "/tmp/x;reboot", ""])(
        "rejects %j", path => {
            expect(() => validatePath(path)).toThrow(ValidationError);
        });
});

describe("validatePassword", () => {
    it("accepts a normal password without warnings", () => {
        expect(validatePassword("s3cret").warning).toBeNull();
    });

    it("warns that classic VNC auth truncates at 8 characters", () => {
        expect(validatePassword("longpassword").warning).toMatch(/8 characters/);
    });

    it("rejects empty, overlong and control-character passwords", () => {
        expect(() => validatePassword("")).toThrow(ValidationError);
        expect(() => validatePassword("x".repeat(65))).toThrow(ValidationError);
        expect(() => validatePassword("pass\nword")).toThrow(ValidationError);
    });
});

describe("display/port helpers", () => {
    it("derives the display number from TigerVNC unit names", () => {
        expect(displayFromUnit("vncserver@:1.service")).toBe(1);
        expect(displayFromUnit("vncserver@:12.service")).toBe(12);
        expect(displayFromUnit("x11vnc.service")).toBeNull();
    });

    it("maps displays to conventional ports", () => {
        expect(portForDisplay(1)).toBe(5901);
    });
});
