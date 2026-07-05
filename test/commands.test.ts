import { describe, expect, it } from "vitest";

import {
    buildChmodArgs,
    buildChownArgs,
    buildGetentPasswdArgs,
    buildGrdctlStatusArgs,
    buildInstallPackagesArgs,
    buildJournalArgs,
    buildListUnitFilesArgs,
    buildLoginctlShowSessionArgs,
    buildMkdirArgs,
    buildSystemctlActionArgs,
    buildSystemctlShowArgs,
    buildVersionArgs,
    buildVncpasswdArgs,
    buildWhichArgs,
} from "../src/services/commands";
import { ValidationError } from "../src/utils/validation";

describe("buildSystemctlActionArgs", () => {
    it("produces exact argv arrays", () => {
        expect(buildSystemctlActionArgs("restart", "vncserver@:1.service"))
            .toEqual(["systemctl", "restart", "vncserver@:1.service"]);
        expect(buildSystemctlActionArgs("enable", "x11vnc.service"))
            .toEqual(["systemctl", "enable", "x11vnc.service"]);
    });

    it("addresses the session manager for user-scoped units", () => {
        expect(buildSystemctlActionArgs("start", "gnome-remote-desktop.service", "user"))
            .toEqual(["systemctl", "--user", "start", "gnome-remote-desktop.service"]);
    });

    it("rejects unknown actions", () => {
        expect(() => buildSystemctlActionArgs("mask" as never, "x11vnc.service"))
            .toThrow(ValidationError);
    });

    it.each([
        "x11vnc.service; rm -rf /",
        "$(reboot).service",
        "-p.service",
        "a b.service",
        "x11vnc.service\n",
    ])("rejects injection attempt %j", unit => {
        expect(() => buildSystemctlActionArgs("start", unit)).toThrow(ValidationError);
    });
});

describe("buildSystemctlShowArgs", () => {
    it("asks for a fixed property list", () => {
        expect(buildSystemctlShowArgs("wayvnc.service")).toEqual([
            "systemctl", "show", "wayvnc.service",
            "--property=LoadState,ActiveState,SubState,UnitFileState,ExecMainStatus",
            "--no-pager",
        ]);
    });

    it("supports user scope", () => {
        expect(buildSystemctlShowArgs("gnome-remote-desktop.service", "user")).toEqual([
            "systemctl", "--user", "show", "gnome-remote-desktop.service",
            "--property=LoadState,ActiveState,SubState,UnitFileState,ExecMainStatus",
            "--no-pager",
        ]);
    });
});

describe("buildJournalArgs", () => {
    it("builds the documented journalctl invocation", () => {
        expect(buildJournalArgs("x11vnc.service", 200)).toEqual([
            "journalctl", "-u", "x11vnc.service", "-n", "200", "--no-pager", "-o", "short-iso",
        ]);
    });

    it("appends a validated priority filter", () => {
        expect(buildJournalArgs("x11vnc.service", 100, 3)).toEqual([
            "journalctl", "-u", "x11vnc.service", "-n", "100", "--no-pager", "-o", "short-iso", "-p", "3",
        ]);
    });

    it("rejects arbitrary line counts and priorities", () => {
        expect(() => buildJournalArgs("x11vnc.service", 12345)).toThrow(ValidationError);
        expect(() => buildJournalArgs("x11vnc.service", 200, 99)).toThrow(ValidationError);
        expect(() => buildJournalArgs("x11vnc.service", 200, 1.5)).toThrow(ValidationError);
    });

    it("rejects unit injection", () => {
        expect(() => buildJournalArgs("-u root.service", 200)).toThrow(ValidationError);
    });

    it("reads the user journal for user-scoped units", () => {
        expect(buildJournalArgs("gnome-remote-desktop.service", 200, null, "user")).toEqual([
            "journalctl", "--user", "-u", "gnome-remote-desktop.service",
            "-n", "200", "--no-pager", "-o", "short-iso",
        ]);
    });
});

describe("buildListUnitFilesArgs", () => {
    it("passes through safe glob patterns", () => {
        expect(buildListUnitFilesArgs(["vncserver@*", "x11vnc*"])).toEqual([
            "systemctl", "list-unit-files", "--type=service",
            "--no-legend", "--no-pager", "--plain", "vncserver@*", "x11vnc*",
        ]);
    });

    it("rejects patterns with shell metacharacters or option injection", () => {
        expect(() => buildListUnitFilesArgs(["$(x)*"])).toThrow(ValidationError);
        expect(() => buildListUnitFilesArgs(["--all"])).toThrow(ValidationError);
        expect(() => buildListUnitFilesArgs(["a b*"])).toThrow(ValidationError);
    });

    it("supports user scope", () => {
        expect(buildListUnitFilesArgs(["gnome-remote-desktop*"], "user")).toEqual([
            "systemctl", "--user", "list-unit-files", "--type=service",
            "--no-legend", "--no-pager", "--plain", "gnome-remote-desktop*",
        ]);
    });
});

describe("buildGrdctlStatusArgs", () => {
    it("takes no arguments at all", () => {
        expect(buildGrdctlStatusArgs()).toEqual(["grdctl", "status"]);
    });
});

describe("binary probes", () => {
    it("builds which/version argv", () => {
        expect(buildWhichArgs("x11vnc")).toEqual(["which", "x11vnc"]);
        expect(buildVersionArgs("Xvnc", "-version")).toEqual(["Xvnc", "-version"]);
        expect(buildVersionArgs("wayvnc", "--version")).toEqual(["wayvnc", "--version"]);
    });

    it("rejects binary names that look like options or paths", () => {
        expect(() => buildWhichArgs("-x")).toThrow(ValidationError);
        expect(() => buildWhichArgs("/bin/sh")).toThrow(ValidationError);
        expect(() => buildWhichArgs("x11vnc; reboot")).toThrow(ValidationError);
    });
});

describe("password plumbing", () => {
    it("vncpasswd receives the password ONLY via stdin, never argv", () => {
        const argv = buildVncpasswdArgs();
        expect(argv).toEqual(["vncpasswd", "-f"]);
        // Regression guard: no builder may accept a password parameter.
        expect(argv.join(" ")).not.toMatch(/pass.*word.*value/i);
    });

    it("file management argv is validated", () => {
        expect(buildMkdirArgs("/etc/cockpitremote")).toEqual(["mkdir", "-p", "/etc/cockpitremote"]);
        expect(buildChmodArgs("600", "/etc/cockpitremote/x11vnc.passwd"))
            .toEqual(["chmod", "600", "/etc/cockpitremote/x11vnc.passwd"]);
        expect(buildChownArgs("alice", "/home/alice/.vnc"))
            .toEqual(["chown", "alice:", "/home/alice/.vnc"]);
        expect(buildGetentPasswdArgs("alice")).toEqual(["getent", "passwd", "alice"]);

        expect(() => buildChmodArgs("a+x", "/tmp/x")).toThrow(ValidationError);
        expect(() => buildMkdirArgs("/tmp/../etc")).toThrow(ValidationError);
        expect(() => buildChownArgs("alice;reboot", "/home/alice")).toThrow(ValidationError);
        expect(() => buildGetentPasswdArgs("alice bob")).toThrow(ValidationError);
    });
});

describe("buildInstallPackagesArgs", () => {
    it("builds per-package-manager argv", () => {
        expect(buildInstallPackagesArgs("dnf", ["tigervnc-server"]))
            .toEqual(["dnf", "install", "-y", "tigervnc-server"]);
        expect(buildInstallPackagesArgs("apt", ["x11vnc"]))
            .toEqual(["apt-get", "install", "-y", "x11vnc"]);
        expect(buildInstallPackagesArgs("zypper", ["wayvnc"]))
            .toEqual(["zypper", "--non-interactive", "install", "wayvnc"]);
    });

    it("rejects empty lists, bad names and unknown managers", () => {
        expect(() => buildInstallPackagesArgs("dnf", [])).toThrow(ValidationError);
        expect(() => buildInstallPackagesArgs("dnf", ["-y; reboot"])).toThrow(ValidationError);
        expect(() => buildInstallPackagesArgs("pacman" as never, ["x"])).toThrow(ValidationError);
    });
});

describe("buildLoginctlShowSessionArgs", () => {
    it("uses one --property flag per name (loginctl ignores comma lists)", () => {
        expect(buildLoginctlShowSessionArgs("c2")).toEqual([
            "loginctl", "show-session", "c2",
            "--property=Id", "--property=Type", "--property=Desktop",
            "--property=Display", "--property=Active", "--property=Class",
            "--property=Name",
        ]);
        expect(() => buildLoginctlShowSessionArgs("c2; reboot")).toThrow(ValidationError);
    });
});
