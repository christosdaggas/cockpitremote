// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

/*
 * GNOME Remote Desktop password handling. The password is only ever held in a
 * local variable while the request is in flight and sent to grdctl on stdin.
 */

import cockpit from "../lib/cockpit";
import { validatePassword } from "../utils/validation";
import {
    buildGrdctlVncEnableArgs,
    buildGrdctlVncSetAuthMethodArgs,
    buildGrdctlVncSetPasswordArgs,
} from "./commands";
import { spawn } from "./spawn";

/**
 * GNOME Remote Desktop prompt mode requires someone at the physical session to
 * approve each connection. Password auth makes Cockpit-originated connections
 * unattended while leaving GRD responsible for storing the secret.
 */
export async function setGrdVncPassword(password: string): Promise<void> {
    validatePassword(password);
    const proc = cockpit.spawn(buildGrdctlVncSetPasswordArgs(), { err: "message" });
    proc.input(password + "\n");
    await proc;
    await spawn(buildGrdctlVncSetAuthMethodArgs("password"));
    await spawn(buildGrdctlVncEnableArgs());
}
