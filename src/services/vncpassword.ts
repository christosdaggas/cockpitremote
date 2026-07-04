/*
 * VNC password handling. The password is only ever:
 *   - held in a local variable while the request is in flight,
 *   - written to the stdin of `vncpasswd -f` (never argv, never logged),
 * and the resulting obfuscated bytes are stored root-owned with mode 600.
 */

import cockpit from "../lib/cockpit";
import { PLUGIN_STATE_DIR, X11VNC_PASSWD_PATH } from "../constants";
import { parseGetentPasswd } from "../utils/parse";
import { ValidationError, validatePassword, validatePath, validateUsername } from "../utils/validation";
import {
    buildChmodArgs,
    buildChownArgs,
    buildGetentPasswdArgs,
    buildMkdirArgs,
    buildVncpasswdArgs,
} from "./commands";
import { spawn } from "./spawn";

async function obfuscate(password: string): Promise<Uint8Array> {
    validatePassword(password);
    const proc = cockpit.spawn(buildVncpasswdArgs(), { binary: true, err: "message" });
    proc.input(password + "\n");
    return await proc;
}

async function writePasswdFile(path: string, bytes: Uint8Array, owner?: string): Promise<void> {
    validatePath(path);
    await cockpit.file(path, { binary: true, superuser: "require" }).replace(bytes);
    await spawn(buildChmodArgs("600", path), { superuser: "require" });
    if (owner)
        await spawn(buildChownArgs(owner, path), { superuser: "require" });
}

/**
 * TigerVNC reads the password of the user mapped in
 * /etc/tigervnc/vncserver.users from that user's ~/.vnc/passwd.
 */
export async function setTigervncUserPassword(user: string, password: string): Promise<void> {
    validateUsername(user);
    const entry = parseGetentPasswd(await spawn(buildGetentPasswdArgs(user), { superuser: "try" }));
    if (!entry)
        throw new ValidationError(`User "${user}" was not found on this system.`);
    validatePath(entry.home);

    const bytes = await obfuscate(password);
    const vncDir = `${entry.home}/.vnc`;
    await spawn(buildMkdirArgs(vncDir), { superuser: "require" });
    await spawn(buildChmodArgs("700", vncDir), { superuser: "require" });
    await spawn(buildChownArgs(user, vncDir), { superuser: "require" });
    await writePasswdFile(`${vncDir}/passwd`, bytes, user);
}

/**
 * x11vnc password file managed by the plugin; point the x11vnc unit at it
 * with `-rfbauth /etc/cockpitremote/x11vnc.passwd`.
 */
export async function setX11vncPassword(password: string): Promise<string> {
    const bytes = await obfuscate(password);
    await spawn(buildMkdirArgs(PLUGIN_STATE_DIR), { superuser: "require" });
    await spawn(buildChmodArgs("700", PLUGIN_STATE_DIR), { superuser: "require" });
    await writePasswdFile(X11VNC_PASSWD_PATH, bytes);
    return X11VNC_PASSWD_PATH;
}
