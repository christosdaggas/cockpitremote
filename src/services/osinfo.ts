import cockpit from "../lib/cockpit";
import type { OsInfo } from "../types";
import { parseOsRelease } from "../utils/parse";

function packageManagerFor(id: string, idLike: string[]): OsInfo["packageManager"] {
    const all = [id, ...idLike];
    if (all.some(v => ["fedora", "rhel", "centos", "almalinux", "rocky"].includes(v)))
        return "dnf";
    if (all.some(v => ["debian", "ubuntu"].includes(v)))
        return "apt";
    if (all.some(v => ["suse", "opensuse", "sles"].includes(v)))
        return "zypper";
    return null;
}

export async function getOsInfo(): Promise<OsInfo> {
    let content: string | null = null;
    for (const path of ["/etc/os-release", "/usr/lib/os-release"]) {
        try {
            content = await cockpit.file(path).read();
            if (content)
                break;
        } catch {
            // try the fallback path
        }
    }
    const fields = parseOsRelease(content ?? "");
    const id = fields.ID ?? "";
    const idLike = (fields.ID_LIKE ?? "").split(/\s+/).filter(Boolean);
    return {
        id,
        idLike,
        prettyName: fields.PRETTY_NAME ?? "this system",
        packageManager: packageManagerFor(id, idLike),
    };
}
