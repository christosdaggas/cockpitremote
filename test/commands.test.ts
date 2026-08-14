import { describe, expect, it } from "vitest";

import {
    buildChmodArgs,
    buildChownArgs,
    buildGetentPasswdArgs,
    buildGrdctlStatusArgs,
    buildGrdctlVncEnableArgs,
    buildGrdctlVncSetAuthMethodArgs,
    buildGrdctlVncSetPasswordArgs,
    buildJournalArgs,
    buildListUnitFilesArgs,
    buildLoginctlShowSessionArgs,
    buildMkdirArgs,
    buildSystemctlActionArgs,
    buildSystemctlEnableNowArgs,
    buildSystemctlShowArgs,
    buildSsListeningProcessArgs,
    buildVersionArgs,
    buildVncScreenShareModeGetArgs,
    buildVncScreenShareModeSetArgs,
    buildVncpasswdArgs,
    buildWhichArgs,
} from "../src/services/commands";
import { ValidationError } from "../src/utils/validation";

describe("buildSystemctlActionArgs", () => {
    it("produces exact argv arrays", () => {
        expect(buildSystemctlActionArgs("restart", "example.service"))
            .toEqual(["systemctl", "restart", "example.service"]);
        expect(buildSystemctlActionArgs("enable", "gnome-remote-desktop.service", "user"))
            .toEqual(["systemctl", "--user", "enable", "gnome-remote-desktop.service"]);
    });

    it("addresses the session manager for user-scoped units", () => {
        expect(buildSystemctlActionArgs("start", "gnome-remote-desktop.service", "user"))
            .toEqual(["systemctl", "--user", "start", "gnome-remote-desktop.service"]);
    });

    it("rejects unknown actions", () => {
        expect(() => buildSystemctlActionArgs("mask" as never, "example.service"))
            .toThrow(ValidationError);
    });

    it.each([
        "example.service; rm -rf /",
        "$(reboot).service",
        "-p.service",
        "a b.service",
        "example.service\n",
    ])("rejects injection attempt %j", unit => {
        expect(() => buildSystemctlActionArgs("start", unit)).toThrow(ValidationError);
    });
});

describe("buildSystemctlEnableNowArgs", () => {
    it("enables and starts a required service atomically", () => {
        expect(buildSystemctlEnableNowArgs("guacd.service"))
            .toEqual(["systemctl", "enable", "--now", "guacd.service"]);
    });

    it("validates the unit name", () => {
        expect(() => buildSystemctlEnableNowArgs("guacd.service; reboot")).toThrow(ValidationError);
    });
});

describe("buildSystemctlShowArgs", () => {
    it("asks for a fixed property list", () => {
        expect(buildSystemctlShowArgs("example.service")).toEqual([
            "systemctl", "show", "example.service",
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

describe("buildSsListeningProcessArgs", () => {
    it("requests listening TCP sockets with process ownership", () => {
        expect(buildSsListeningProcessArgs()).toEqual(["ss", "-tlnpH"]);
    });
});

describe("buildJournalArgs", () => {
    it("builds the documented journalctl invocation", () => {
        expect(buildJournalArgs("example.service", 200)).toEqual([
            "journalctl", "-u", "example.service", "-n", "200", "--no-pager", "-o", "short-iso",
        ]);
    });

    it("appends a validated priority filter", () => {
        expect(buildJournalArgs("example.service", 100, 3)).toEqual([
            "journalctl", "-u", "example.service", "-n", "100", "--no-pager", "-o", "short-iso", "-p", "3",
        ]);
    });

    it("rejects arbitrary line counts and priorities", () => {
        expect(() => buildJournalArgs("example.service", 12345)).toThrow(ValidationError);
        expect(() => buildJournalArgs("example.service", 200, 99)).toThrow(ValidationError);
        expect(() => buildJournalArgs("example.service", 200, 1.5)).toThrow(ValidationError);
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
        expect(buildListUnitFilesArgs(["example*", "gnome-remote-desktop*"])).toEqual([
            "systemctl", "list-unit-files", "--type=service",
            "--no-legend", "--no-pager", "--plain", "example*", "gnome-remote-desktop*",
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
    it("defaults to the calling user's configuration", () => {
        expect(buildGrdctlStatusArgs()).toEqual(["grdctl", "status"]);
        expect(buildGrdctlStatusArgs("user")).toEqual(["grdctl", "status"]);
    });

    it("reads the system Remote Login daemon with --system", () => {
        expect(buildGrdctlStatusArgs("system")).toEqual(["grdctl", "--system", "status"]);
    });

    it("builds GNOME Remote Desktop VNC configuration commands without password argv", () => {
        expect(buildGrdctlVncEnableArgs()).toEqual(["grdctl", "vnc", "enable"]);
        expect(buildGrdctlVncSetPasswordArgs()).toEqual(["grdctl", "vnc", "set-password"]);
        expect(buildGrdctlVncSetAuthMethodArgs("password")).toEqual([
            "grdctl", "vnc", "set-auth-method", "password",
        ]);
    });

    it("rejects unknown GNOME Remote Desktop VNC auth methods", () => {
        expect(() => buildGrdctlVncSetAuthMethodArgs("none" as never)).toThrow(ValidationError);
    });
});

describe("VNC screen-share mode", () => {
    it("addresses exactly one GSettings key", () => {
        expect(buildVncScreenShareModeGetArgs()).toEqual([
            "gsettings", "get", "org.gnome.desktop.remote-desktop.vnc", "screen-share-mode",
        ]);
        expect(buildVncScreenShareModeSetArgs("extend")).toEqual([
            "gsettings", "set", "org.gnome.desktop.remote-desktop.vnc", "screen-share-mode", "extend",
        ]);
        expect(buildVncScreenShareModeSetArgs("mirror-primary")).toEqual([
            "gsettings", "set", "org.gnome.desktop.remote-desktop.vnc", "screen-share-mode", "mirror-primary",
        ]);
    });

    it.each([
        "headless",
        "",
        "--schemadir",
        "extend org.gnome.desktop.remote-desktop.rdp",
    ])("rejects value %j, which is not in the schema's enum", mode => {
        expect(() => buildVncScreenShareModeSetArgs(mode as never)).toThrow(ValidationError);
    });
});

describe("binary probes", () => {
    it("builds which/version argv", () => {
        expect(buildWhichArgs("grdctl")).toEqual(["which", "grdctl"]);
        expect(buildVersionArgs("grdctl", "--version")).toEqual(["grdctl", "--version"]);
    });

    it("rejects binary names that look like options or paths", () => {
        expect(() => buildWhichArgs("-x")).toThrow(ValidationError);
        expect(() => buildWhichArgs("/bin/sh")).toThrow(ValidationError);
        expect(() => buildWhichArgs("example; reboot")).toThrow(ValidationError);
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
        expect(buildChmodArgs("600", "/etc/cockpitremote/grd.passwd"))
            .toEqual(["chmod", "600", "/etc/cockpitremote/grd.passwd"]);
        expect(buildChownArgs("alice", "/home/alice/.vnc"))
            .toEqual(["chown", "alice:", "/home/alice/.vnc"]);
        expect(buildGetentPasswdArgs("alice")).toEqual(["getent", "passwd", "alice"]);

        expect(() => buildChmodArgs("a+x", "/tmp/x")).toThrow(ValidationError);
        expect(() => buildMkdirArgs("/tmp/../etc")).toThrow(ValidationError);
        expect(() => buildChownArgs("alice;reboot", "/home/alice")).toThrow(ValidationError);
        expect(() => buildGetentPasswdArgs("alice bob")).toThrow(ValidationError);
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
