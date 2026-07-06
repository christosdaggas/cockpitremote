import Guacamole, {
    type GuacamoleParser,
    type GuacamoleStatus,
    type GuacamoleTunnel,
} from "guacamole-common-js";

import { GUACD_ADDRESS, GUACD_PORT, RDP_DPI } from "../constants";
import { validateAddress, validatePort } from "../utils/validation";
import { buildStreamUrl } from "./channel";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type GuacdProtocol = "rdp" | "vnc";

export interface GuacdCredentials {
    username: string;
    password: string;
    domain: string;
}

export interface GuacdConnectionOptions extends GuacdCredentials {
    protocol: GuacdProtocol;
    hostname: string;
    port: number;
    width: number;
    height: number;
    dpi?: number;
    timezone?: string;
    guacdAddress?: string;
    guacdPort?: number;
}

export function encodeInstruction(...elements: unknown[]): string {
    if (elements.length === 0)
        return "";
    return elements.map(element => {
        const value = String(element);
        return `${value.length}.${value}`;
    }).join(",") + ";";
}

export function buildGuacdConnectArgs(names: string[], options: GuacdConnectionOptions): string[] {
    const width = String(Math.max(1, Math.round(options.width)));
    const height = String(Math.max(1, Math.round(options.height)));
    const dpi = String(options.dpi ?? RDP_DPI);
    const common: Record<string, string> = {
        hostname: options.hostname,
        port: String(options.port),
        username: options.username,
        password: options.password,
        "read-only": "false",
        "disable-copy": "true",
        "disable-paste": "true",
        "force-lossless": "false",
    };
    const rdp: Record<string, string> = {
        ...common,
        domain: options.domain,
        width,
        height,
        dpi,
        "color-depth": "32",
        "resize-method": "display-update",
        security: "any",
        "ignore-cert": "true",
        "disable-auth": "false",
        "enable-wallpaper": "true",
        "enable-theming": "true",
        "enable-font-smoothing": "true",
        "enable-full-window-drag": "true",
        "enable-desktop-composition": "true",
        "enable-menu-animations": "true",
        "disable-audio": "true",
        "enable-audio": "false",
        "enable-audio-input": "false",
        "enable-printing": "false",
        "enable-drive": "false",
        "enable-sftp": "false",
        "server-layout": "en-us-qwerty",
        timezone: options.timezone ?? "",
        "client-name": "Cockpit Remote Desktop",
    };
    const vnc: Record<string, string> = {
        ...common,
        "disable-display-resize": "false",
        encodings: "",
        "swap-red-blue": "false",
        "color-depth": "32",
        cursor: "local",
        autoretry: "0",
        "clipboard-encoding": "UTF-8",
        "dest-host": "",
        "dest-port": "",
        "enable-audio": "false",
        "audio-servername": "",
        "reverse-connect": "false",
        "listen-timeout": "",
        "enable-sftp": "false",
        "recording-path": "",
        "recording-name": "",
        "recording-exclude-output": "true",
        "recording-exclude-mouse": "true",
        "recording-include-keys": "false",
        "create-recording-path": "false",
        "recording-write-existing": "false",
        "compress-level": "2",
        "quality-level": "6",
    };
    const values = options.protocol === "vnc" ? vnc : rdp;
    return names.map(name => name.startsWith("VERSION_") ? name : (values[name] ?? ""));
}

export class RawGuacdTunnel implements GuacamoleTunnel {
    state = Guacamole.Tunnel.State.CLOSED;
    receiveTimeout = 15000;
    unstableThreshold = 1500;
    uuid: string | null = null;
    onuuid: ((uuid: string) => void) | null = null;
    onerror: ((status: GuacamoleStatus) => void) | null = null;
    onstatechange: ((state: number) => void) | null = null;
    oninstruction: ((opcode: string, parameters: string[]) => void) | null = null;

    private readonly options: GuacdConnectionOptions;
    private readonly parser: GuacamoleParser;
    private readonly decoder = new TextDecoder();
    private socket: WebSocket | null = null;
    private ready = false;

    constructor(options: GuacdConnectionOptions) {
        validateAddress(options.hostname);
        validatePort(options.port);
        validateAddress(options.guacdAddress ?? GUACD_ADDRESS);
        validatePort(options.guacdPort ?? GUACD_PORT);
        this.options = options;
        this.parser = new Guacamole.Parser();
        this.parser.oninstruction = (opcode, parameters) => this.handleInstruction(opcode, parameters);
    }

    connect(): void {
        if (this.socket)
            this.disconnect();

        this.ready = false;
        this.setState(Guacamole.Tunnel.State.CONNECTING);
        const socket = new WebSocket(buildStreamUrl(
            this.options.guacdPort ?? GUACD_PORT,
            this.options.guacdAddress ?? GUACD_ADDRESS));
        socket.binaryType = "arraybuffer";
        this.socket = socket;

        socket.onopen = () => {
            this.sendRaw("select", this.options.protocol);
        };

        socket.onmessage = event => {
            this.receive(event.data);
        };

        socket.onerror = () => {
            this.closeWithStatus(new Guacamole.Status(
                Guacamole.Status.Code.UPSTREAM_UNAVAILABLE,
                "Could not reach guacd through Cockpit's stream channel."));
        };

        socket.onclose = event => {
            if (this.state === Guacamole.Tunnel.State.CLOSED)
                return;
            const status = event.wasClean
                ? new Guacamole.Status(Guacamole.Status.Code.SUCCESS, "The guacd stream closed.")
                : new Guacamole.Status(Guacamole.Status.Code.UPSTREAM_ERROR, "The guacd stream closed unexpectedly.");
            this.closeWithStatus(status, false);
        };
    }

    disconnect(): void {
        this.closeWithStatus(new Guacamole.Status(Guacamole.Status.Code.SUCCESS, "Manually closed."));
    }

    sendMessage(...elements: unknown[]): void {
        if (!this.isConnected() || elements.length === 0)
            return;
        this.sendRaw(...elements);
    }

    setState(state: number): void {
        if (state === this.state)
            return;
        this.state = state;
        this.onstatechange?.(state);
    }

    setUUID(uuid: string): void {
        this.uuid = uuid;
        this.onuuid?.(uuid);
    }

    isConnected(): boolean {
        return this.state === Guacamole.Tunnel.State.OPEN ||
            this.state === Guacamole.Tunnel.State.UNSTABLE;
    }

    private receive(data: string | ArrayBuffer | Blob): void {
        if (typeof data === "string") {
            this.receiveText(data);
            return;
        }
        if (data instanceof ArrayBuffer) {
            this.receiveText(this.decoder.decode(data));
            return;
        }
        data.text().then(text => this.receiveText(text)).catch(() => {
            this.closeWithStatus(new Guacamole.Status(
                Guacamole.Status.Code.SERVER_ERROR,
                "Could not decode data received from guacd."));
        });
    }

    private receiveText(text: string): void {
        try {
            this.parser.receive(text);
        } catch (err) {
            this.closeWithStatus(new Guacamole.Status(
                Guacamole.Status.Code.SERVER_ERROR,
                (err as Error).message || "Invalid Guacamole instruction from guacd."));
        }
    }

    private handleInstruction(opcode: string, parameters: string[]): void {
        if (this.ready) {
            this.oninstruction?.(opcode, parameters);
            return;
        }

        if (opcode === "args") {
            this.sendRaw("size", Math.round(this.options.width), Math.round(this.options.height), this.options.dpi ?? RDP_DPI);
            this.sendRaw("audio");
            this.sendRaw("video");
            this.sendRaw("image", ...IMAGE_TYPES);
            this.sendRaw("timezone", this.options.timezone ?? "");
            this.sendRaw("name", "Cockpit Remote Desktop");
            this.sendRaw("connect", ...buildGuacdConnectArgs(parameters, this.options));
            return;
        }

        if (opcode === "ready") {
            this.ready = true;
            this.setUUID(parameters[0] ?? "");
            this.setState(Guacamole.Tunnel.State.OPEN);
            return;
        }

        if (opcode === "error") {
            const reason = parameters[0] || `guacd rejected the ${this.options.protocol.toUpperCase()} connection.`;
            const code = Number(parameters[1]) || Guacamole.Status.Code.UPSTREAM_ERROR;
            this.closeWithStatus(new Guacamole.Status(code, reason));
            return;
        }

        this.closeWithStatus(new Guacamole.Status(
            Guacamole.Status.Code.SERVER_ERROR,
            `Unexpected guacd handshake instruction: ${opcode}.`));
    }

    private sendRaw(...elements: unknown[]): void {
        const socket = this.socket;
        if (!socket || socket.readyState !== WebSocket.OPEN)
            return;
        socket.send(encodeInstruction(...elements));
    }

    private closeWithStatus(status: GuacamoleStatus, closeSocket = true): void {
        const socket = this.socket;
        this.socket = null;
        this.ready = false;

        if (status.code !== Guacamole.Status.Code.SUCCESS)
            this.onerror?.(status);

        this.setState(Guacamole.Tunnel.State.CLOSED);

        if (closeSocket && socket && socket.readyState !== WebSocket.CLOSED)
            socket.close();
    }
}
