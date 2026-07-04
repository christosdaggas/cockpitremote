/*
 * Builds the WebSocket URL that lets noVNC reach the host-local VNC server
 * through Cockpit's own authenticated transport. This is the exact mechanism
 * cockpit-machines uses for VM consoles: a raw "stream" channel is addressed
 * via /cockpit/channel/<csrf-token>?<base64-encoded JSON options>, so the VNC
 * server can stay bound to 127.0.0.1 and no additional port is exposed.
 */

import cockpit from "../lib/cockpit";
import { validateAddress, validatePort } from "../utils/validation";

export class ChannelUnsupportedError extends Error {
    constructor() {
        super("This Cockpit version does not expose the channel WebSocket API required for the remote desktop console.");
        this.name = "ChannelUnsupportedError";
    }
}

export function channelTransportAvailable(): boolean {
    return typeof cockpit !== "undefined" &&
        typeof cockpit.transport?.uri === "function" &&
        typeof cockpit.transport?.csrf_token === "string" &&
        cockpit.transport.csrf_token.length > 0;
}

export function buildConsoleUrl(port: number, address = "127.0.0.1"): string {
    validatePort(port);
    validateAddress(address);
    if (!channelTransportAvailable())
        throw new ChannelUnsupportedError();

    const transport = cockpit.transport!;
    const prefix = new URL(transport.uri("channel/" + transport.csrf_token)).pathname;
    const options: Record<string, unknown> = {
        payload: "stream",
        binary: "raw",
        address,
        port,
    };
    // Route to the correct host when Cockpit is connected to a secondary one.
    if (transport.host)
        options.host = transport.host;
    const query = window.btoa(JSON.stringify(options));

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsPort = window.location.port || (protocol === "wss" ? "443" : "80");
    return `${protocol}://${window.location.hostname}:${wsPort}/${prefix.slice(1)}?${query}`;
}
