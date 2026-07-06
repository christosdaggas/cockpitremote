/*
 * All user-supplied values are validated here before they can reach a command
 * builder. Policy: reject invalid input outright — never rewrite/sanitize it.
 */

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

/*
 * systemd unit name, restricted to .service units. First character must be
 * alphanumeric so a unit name can never be mistaken for a command-line option
 * (no leading "-"), and the character class excludes whitespace and every
 * shell metacharacter.
 */
export const UNIT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9@:._-]{0,254}\.service$/;

export function validateUnitName(unit: string): string {
    if (typeof unit !== "string" || !UNIT_NAME_RE.test(unit))
        throw new ValidationError(
            `Invalid systemd unit name: ${JSON.stringify(unit)}. ` +
            "Expected something like \"gnome-remote-desktop.service\".");
    return unit;
}

export const PORT_MIN = 1;
export const PORT_MAX = 65535;

export function validatePort(port: number): number {
    if (!Number.isInteger(port) || port < PORT_MIN || port > PORT_MAX)
        throw new ValidationError(`Invalid TCP port: ${JSON.stringify(port)} (must be 1-65535).`);
    return port;
}

/** Non-blocking advice shown next to unusual (but valid) ports. */
export function portWarning(port: number): string | null {
    if (port < 5900 || port > 5999)
        return "VNC servers conventionally listen on ports 5900-5999. Double-check this value.";
    return null;
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function validateAddress(address: string): string {
    if (address === "localhost")
        return address;
    const m = IPV4_RE.exec(address);
    if (!m || m.slice(1).some(octet => Number(octet) > 255))
        throw new ValidationError(
            `Invalid address: ${JSON.stringify(address)}. Use "127.0.0.1", "localhost" or an IPv4 address.`);
    return address;
}

export function isLoopback(address: string): boolean {
    return address === "localhost" || address.startsWith("127.");
}

export const GEOMETRY_RE = /^(\d{3,5})x(\d{3,5})$/;

export function validateGeometry(geometry: string): string {
    const m = GEOMETRY_RE.exec(geometry);
    if (!m)
        throw new ValidationError(`Invalid geometry: ${JSON.stringify(geometry)}. Expected WIDTHxHEIGHT, e.g. "1280x800".`);
    const [width, height] = [Number(m[1]), Number(m[2])];
    if (width < 640 || width > 7680 || height < 480 || height > 4320)
        throw new ValidationError(`Geometry out of range: ${geometry} (supported: 640x480 up to 7680x4320).`);
    return geometry;
}

/** POSIX-ish login name; matches useradd's default constraints. */
export const USERNAME_RE = /^[a-z_][a-z0-9_-]{0,31}\$?$/;

export function validateUsername(user: string): string {
    if (typeof user !== "string" || !USERNAME_RE.test(user))
        throw new ValidationError(`Invalid Unix user name: ${JSON.stringify(user)}.`);
    return user;
}

export const BINARY_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function validateBinaryName(binary: string): string {
    if (typeof binary !== "string" || !BINARY_NAME_RE.test(binary))
        throw new ValidationError(`Invalid binary name: ${JSON.stringify(binary)}.`);
    return binary;
}

/** Absolute path with a conservative character set and no ".." traversal. */
export const SAFE_PATH_RE = /^\/[A-Za-z0-9._/@-]+$/;

export function validatePath(path: string): string {
    if (typeof path !== "string" || !SAFE_PATH_RE.test(path) ||
        path.split("/").some(seg => seg === ".." || seg.startsWith("-")))
        throw new ValidationError(`Unsupported file path: ${JSON.stringify(path)}.`);
    return path;
}

export const PACKAGE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/;

export function validatePackageName(pkg: string): string {
    if (typeof pkg !== "string" || !PACKAGE_NAME_RE.test(pkg))
        throw new ValidationError(`Invalid package name: ${JSON.stringify(pkg)}.`);
    return pkg;
}

export const SESSION_ID_RE = /^[A-Za-z0-9._-]{1,32}$/;

export function validateSessionId(id: string): string {
    if (typeof id !== "string" || !SESSION_ID_RE.test(id))
        throw new ValidationError(`Invalid login session id: ${JSON.stringify(id)}.`);
    return id;
}

export interface PasswordCheck {
    warning: string | null;
}

/*
 * VNC passwords: classic VNC (DES) authentication only uses the first 8
 * characters — warn, but do not block, longer passwords.
 */
export function validatePassword(password: string): PasswordCheck {
    if (typeof password !== "string" || password.length === 0)
        throw new ValidationError("Password must not be empty.");
    if (password.length > 64)
        throw new ValidationError("Password is too long (maximum 64 characters).");
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(password))
        throw new ValidationError("Password must not contain control characters.");
    return {
        warning: password.length > 8
            ? "Classic VNC authentication only uses the first 8 characters of the password."
            : null,
    };
}
