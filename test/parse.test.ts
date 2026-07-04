import { describe, expect, it } from "vitest";

import {
    extractVersion,
    parseGetentPasswd,
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
            "vncserver@.service                         disabled        disabled",
            "gnome-remote-desktop.service               static          -",
            "x11vnc.service                             enabled         enabled",
            "",
        ].join("\n");
        expect(parseUnitFiles(fixture)).toEqual([
            "vncserver@.service",
            "gnome-remote-desktop.service",
            "x11vnc.service",
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
            "LISTEN 0      128        127.0.0.1:5901       0.0.0.0:*",
            "LISTEN 0      5          [::1]:5901              [::]:*",
            "LISTEN 0      511                *:80                *:*",
            "LISTEN 0      4096       0.0.0.0:9090         0.0.0.0:*",
            "",
        ].join("\n");
        expect(parseSsListening(fixture)).toEqual([
            { address: "127.0.0.1", port: 5901 },
            { address: "::1", port: 5901 },
            { address: "*", port: 80 },
            { address: "0.0.0.0", port: 9090 },
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

describe("extractVersion", () => {
    it("finds versions in typical tool banners", () => {
        expect(extractVersion("Xvnc TigerVNC 1.13.1 - built ...")).toBe("1.13.1");
        expect(extractVersion("x11vnc: 0.9.16 lastmod: 2019-01-05")).toBe("0.9.16");
        expect(extractVersion("wayvnc: v0.8.0")).toBe("0.8.0");
        expect(extractVersion("no version here")).toBeNull();
    });
});
