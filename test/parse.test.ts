import { describe, expect, it } from "vitest";

import {
    extractVersion,
    parseGetentPasswd,
    parseGsettingsValue,
    parseGrdStatus,
    parseKeyValueOutput,
    parseOsRelease,
    parseSessionIds,
    parseSsListening,
    parseUnitFiles,
} from "../src/utils/parse";

describe("parseKeyValueOutput", () => {
    it("parses systemctl show output", () => {
        const fixture = [
            "LoadState=loaded",
            "ActiveState=active",
            "SubState=running",
            "UnitFileState=enabled",
            "ExecMainStatus=0",
            "",
        ].join("\n");
        expect(parseKeyValueOutput(fixture)).toEqual({
            LoadState: "loaded",
            ActiveState: "active",
            SubState: "running",
            UnitFileState: "enabled",
            ExecMainStatus: "0",
        });
    });

    it("keeps '=' inside values and ignores malformed lines", () => {
        const out = parseKeyValueOutput("Desktop=GNOME\nWeird\nExec=/bin/x --a=b\n");
        expect(out.Desktop).toBe("GNOME");
        expect(out.Exec).toBe("/bin/x --a=b");
        expect(Object.keys(out)).toHaveLength(2);
    });

    it("handles empty output", () => {
        expect(parseKeyValueOutput("")).toEqual({});
    });
});

describe("parseUnitFiles", () => {
    it("parses list-unit-files --no-legend --plain output", () => {
        const fixture = [
            "gnome-remote-desktop.service               static          -",
            "example.service                            enabled         enabled",
            "",
        ].join("\n");
        expect(parseUnitFiles(fixture)).toEqual([
            "gnome-remote-desktop.service",
            "example.service",
        ]);
    });

    it("ignores non-service lines and empty output", () => {
        expect(parseUnitFiles("")).toEqual([]);
        expect(parseUnitFiles("0 unit files listed.\n")).toEqual([]);
    });
});

describe("parseSsListening", () => {
    it("parses ss -tlnH output including IPv6 and wildcards", () => {
        const fixture = [
            "LISTEN 0      128        127.0.0.1:5900       0.0.0.0:*",
            "LISTEN 0      5          [::1]:5900              [::]:*",
            "LISTEN 0      511                *:80                *:*",
            "LISTEN 0      4096       0.0.0.0:9090         0.0.0.0:*",
            'LISTEN 0      5                  *:3390              *:* users:(("gnome-remote-de",pid=26361,fd=18))',
            "",
        ].join("\n");
        expect(parseSsListening(fixture)).toEqual([
            { address: "127.0.0.1", port: 5900 },
            { address: "::1", port: 5900 },
            { address: "*", port: 80 },
            { address: "0.0.0.0", port: 9090 },
            { address: "*", port: 3390, processes: ["gnome-remote-de"] },
        ]);
    });

    it("tolerates empty and malformed output", () => {
        expect(parseSsListening("")).toEqual([]);
        expect(parseSsListening("garbage line\nshort")).toEqual([]);
    });
});

describe("parseOsRelease", () => {
    it("parses a Fedora os-release", () => {
        const fixture = [
            'NAME="Fedora Linux"',
            'VERSION="44 (Workstation Edition)"',
            "ID=fedora",
            'PRETTY_NAME="Fedora Linux 44 (Workstation Edition)"',
        ].join("\n");
        const fields = parseOsRelease(fixture);
        expect(fields.ID).toBe("fedora");
        expect(fields.PRETTY_NAME).toBe("Fedora Linux 44 (Workstation Edition)");
    });

    it("parses an Ubuntu os-release with ID_LIKE", () => {
        const fields = parseOsRelease('ID=ubuntu\nID_LIKE=debian\nPRETTY_NAME="Ubuntu 24.04 LTS"\n');
        expect(fields.ID_LIKE).toBe("debian");
    });
});

describe("parseGetentPasswd", () => {
    it("parses a passwd entry", () => {
        expect(parseGetentPasswd("alice:x:1000:1000:Alice:/home/alice:/bin/bash\n")).toEqual({
            user: "alice",
            uid: 1000,
            gid: 1000,
            home: "/home/alice",
            shell: "/bin/bash",
        });
    });

    it("returns null for empty or malformed output", () => {
        expect(parseGetentPasswd("")).toBeNull();
        expect(parseGetentPasswd("not-a-passwd-line")).toBeNull();
    });
});

describe("parseSessionIds", () => {
    it("extracts ids from old- and new-style loginctl output", () => {
        const oldStyle = "     c2 1000 alice seat0 tty2\n     c5 1001 bob\n";
        expect(parseSessionIds(oldStyle)).toEqual(["c2", "c5"]);
        const newStyle = "2 1000 alice seat0 - user tty2 no -\n";
        expect(parseSessionIds(newStyle)).toEqual(["2"]);
    });

    it("handles no sessions", () => {
        expect(parseSessionIds("")).toEqual([]);
        expect(parseSessionIds("\n")).toEqual([]);
    });
});

describe("parseGrdStatus", () => {
    // Captured verbatim from grdctl 50.1 on Fedora 44.
    const withVnc = [
        "Overall:",
        "\tUnit status: active",
        "RDP:",
        "\tStatus: enabled",
        "\tPort: 3389",
        "\tAuthentication methods: credentials",
        "\tTLS certificate: /home/alice/.local/share/gnome-remote-desktop/certificates/rdp-tls.crt",
        "\tView-only: no",
        "\tNegotiate port: yes",
        "\tUsername: (hidden)",
        "\tPassword: (hidden)",
        "VNC:",
        "\tStatus: disabled",
        "\tPort: 5900",
        "\tAuth method: prompt",
        "\tView-only: yes",
        "\tNegotiate port: no",
        "\tPassword: (empty)",
        "",
    ].join("\n");

    it("reports VNC capability, enablement, port, view-only and auth", () => {
        expect(parseGrdStatus(withVnc)).toEqual({
            hasRdp: true,
            rdpEnabled: true,
            rdpPort: 3389,
            rdpNegotiatePort: true,
            rdpViewOnly: false,
            rdpAuthMethods: "credentials",
            rdpPasswordEmpty: false,
            hasVnc: true,
            vncEnabled: false,
            vncPort: 5900,
            vncViewOnly: true,
            vncAuthMethod: "prompt",
            vncPasswordEmpty: true,
        });
    });

    it("reads an enabled, controllable VNC section", () => {
        const enabled = withVnc
            .replace("\tStatus: disabled", "\tStatus: enabled")
            .replace("\tView-only: yes", "\tView-only: no")
            .replace("\tAuth method: prompt", "\tAuth method: password")
            .replace("\tPassword: (empty)", "\tPassword: (hidden)");
        expect(parseGrdStatus(enabled)).toEqual({
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
        });
    });

    it("detects RDP-only builds (no VNC section)", () => {
        const rdpOnly = withVnc.split("VNC:")[0];
        expect(parseGrdStatus(rdpOnly)).toEqual({
            hasRdp: true,
            rdpEnabled: true,
            rdpPort: 3389,
            rdpNegotiatePort: true,
            rdpViewOnly: false,
            rdpAuthMethods: "credentials",
            rdpPasswordEmpty: false,
            hasVnc: false,
            vncEnabled: false,
            vncPort: null,
            vncViewOnly: false,
            vncAuthMethod: null,
            vncPasswordEmpty: false,
        });
    });

    it("parses the system Remote Login daemon's status", () => {
        // "grdctl --system status" omits the VNC section and the port
        // negotiation field entirely, so the headless port is taken as-is.
        const system = [
            "Overall:",
            "\tUnit status: active",
            "RDP:",
            "\tStatus: enabled",
            "\tPort: 3389",
            "\tAuthentication methods: credentials",
            "\tTLS certificate: /var/lib/gnome-remote-desktop/rdp-tls.crt",
            "\tTLS key: /var/lib/gnome-remote-desktop/rdp-tls.key",
            "\tKerberos keytab: (null)",
            "\tUsername: (hidden)",
            "\tPassword: (hidden)",
            "",
        ].join("\n");
        expect(parseGrdStatus(system)).toEqual({
            hasRdp: true,
            rdpEnabled: true,
            rdpPort: 3389,
            rdpNegotiatePort: false,
            rdpViewOnly: false,
            rdpAuthMethods: "credentials",
            rdpPasswordEmpty: false,
            hasVnc: false,
            vncEnabled: false,
            vncPort: null,
            vncViewOnly: false,
            vncAuthMethod: null,
            vncPasswordEmpty: false,
        });
    });

    it("does not read RDP fields as VNC fields", () => {
        // RDP is enabled on port 3389; VNC must not inherit either value.
        expect(parseGrdStatus(withVnc).vncPort).toBe(5900);
        const vncFirst = parseGrdStatus(withVnc.split("VNC:")[0] + "VNC:\n\tAuth method: prompt\n");
        expect(vncFirst).toEqual({
            hasRdp: true,
            rdpEnabled: true,
            rdpPort: 3389,
            rdpNegotiatePort: true,
            rdpViewOnly: false,
            rdpAuthMethods: "credentials",
            rdpPasswordEmpty: false,
            hasVnc: true,
            vncEnabled: false,
            vncPort: null,
            vncViewOnly: false,
            vncAuthMethod: "prompt",
            vncPasswordEmpty: false,
        });
    });

    it("tolerates empty and garbage output", () => {
        expect(parseGrdStatus("").hasVnc).toBe(false);
        expect(parseGrdStatus("error: cannot connect to the display\n").hasVnc).toBe(false);
    });
});

describe("parseGsettingsValue", () => {
    it("unwraps the quoted enum gsettings prints", () => {
        expect(parseGsettingsValue("'mirror-primary'\n")).toBe("mirror-primary");
        expect(parseGsettingsValue("'extend'\n")).toBe("extend");
    });

    it("leaves unquoted values alone", () => {
        expect(parseGsettingsValue("true\n")).toBe("true");
        expect(parseGsettingsValue("")).toBe("");
        expect(parseGsettingsValue("'")).toBe("'");
    });
});

describe("extractVersion", () => {
    it("finds versions in typical tool banners", () => {
        expect(extractVersion("grdctl 50.1")).toBe("50.1");
        expect(extractVersion("exampled: v0.8.0")).toBe("0.8.0");
        expect(extractVersion("no version here")).toBeNull();
    });
});
