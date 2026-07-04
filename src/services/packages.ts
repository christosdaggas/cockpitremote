import { buildInstallPackagesArgs, type PackageManager } from "./commands";
import { spawn } from "./spawn";

/** Only ever invoked from an explicit, user-confirmed dialog. */
export async function installPackages(pm: PackageManager, packages: string[]): Promise<void> {
    await spawn(buildInstallPackagesArgs(pm, packages), { superuser: "require" });
}
