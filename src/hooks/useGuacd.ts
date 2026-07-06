import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Guacamole, {
    type GuacamoleClient,
    type GuacamoleKeyboard,
    type GuacamoleMouseEvent,
    type GuacamoleStatus,
} from "guacamole-common-js";

import { CONNECT_TIMEOUT_MS, RDP_DPI } from "../constants";
import { RawGuacdTunnel, type GuacdCredentials, type GuacdProtocol } from "../services/guacdTunnel";
import type { UiPrefs } from "../types";
import type { ConsoleState } from "./consoleState";

interface PendingTarget {
    port: number;
    address: string;
}

export interface GuacdControls {
    state: ConsoleState;
    connect: (port: number, address: string) => void;
    disconnect: () => void;
    sendCredentials: (credentials: GuacdCredentials) => void;
    sendCtrlAltDel: () => void;
}

const CTRL = 0xffe3;
const ALT = 0xffe9;
const DELETE = 0xffff;

function statusMessage(status: GuacamoleStatus): string {
    return status.message || `Guacamole error ${status.code}`;
}

function displaySize(container: HTMLDivElement): { width: number; height: number } {
    const rect = container.getBoundingClientRect();
    return {
        width: Math.max(640, Math.round(rect.width || container.clientWidth || 1280)),
        height: Math.max(480, Math.round(rect.height || container.clientHeight || 800)),
    };
}

export function useGuacd(container: RefObject<HTMLDivElement>, prefs: UiPrefs, protocol: GuacdProtocol = "rdp"): GuacdControls {
    const [state, setState] = useState<ConsoleState>({ kind: "idle" });
    const clientRef = useRef<GuacamoleClient | null>(null);
    const keyboardRef = useRef<GuacamoleKeyboard | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const pendingTargetRef = useRef<PendingTarget | null>(null);
    const failureRef = useRef<string | null>(null);
    const everConnectedRef = useRef(false);
    const intentionalDisconnectRef = useRef(false);
    const prefsRef = useRef(prefs);
    prefsRef.current = prefs;

    const clearConnectTimeout = useCallback(() => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const applyScale = useCallback(() => {
        const client = clientRef.current;
        const target = container.current;
        if (!client || !target)
            return;

        const display = client.getDisplay();
        const width = display.getWidth();
        const height = display.getHeight();
        if (!width || !height) {
            display.scale(1);
            return;
        }

        if (!prefsRef.current.scaleViewport) {
            display.scale(1);
            return;
        }

        const rect = target.getBoundingClientRect();
        const scale = Math.max(0.1, Math.min(rect.width / width, rect.height / height));
        display.scale(Number.isFinite(scale) ? scale : 1);
    }, [container]);

    const teardown = useCallback(() => {
        clearConnectTimeout();
        resizeObserverRef.current?.disconnect();
        resizeObserverRef.current = null;

        keyboardRef.current?.reset();
        keyboardRef.current = null;

        const client = clientRef.current;
        clientRef.current = null;
        if (client) {
            client.onstatechange = null;
            client.onerror = null;
            client.onsync = null;
            try {
                client.disconnect();
            } catch {
                // already closed
            }
        }

        const target = container.current;
        if (target)
            target.replaceChildren();
    }, [clearConnectTimeout, container]);

    const armConnectTimeout = useCallback(() => {
        clearConnectTimeout();
        timeoutRef.current = window.setTimeout(() => {
            teardown();
            setState({
                kind: "error",
                message: `${protocol.toUpperCase()}/guacd did not respond within ${CONNECT_TIMEOUT_MS / 1000} seconds. ` +
                    `Check that guacd is running and ${protocol.toUpperCase()} is listening.`,
            });
        }, CONNECT_TIMEOUT_MS);
    }, [clearConnectTimeout, protocol, teardown]);

    useEffect(() => {
        applyScale();
    }, [prefs.scaleViewport, applyScale]);

    const connect = useCallback((port: number, address: string) => {
        teardown();
        pendingTargetRef.current = { port, address };
        failureRef.current = null;
        everConnectedRef.current = false;
        intentionalDisconnectRef.current = false;
        setState({ kind: "credentials", message: null });
    }, [teardown]);

    const sendCredentials = useCallback((credentials: GuacdCredentials) => {
        const pending = pendingTargetRef.current;
        const target = container.current;
        if (!pending || !target) {
            setState({ kind: "error", message: "The console area is not ready yet. Try again." });
            return;
        }

        teardown();
        pendingTargetRef.current = pending;
        failureRef.current = null;
        everConnectedRef.current = false;
        intentionalDisconnectRef.current = false;

        const size = displaySize(target);
        let tunnel: RawGuacdTunnel;
        let client: GuacamoleClient;
        try {
            tunnel = new RawGuacdTunnel({
                protocol,
                hostname: pending.address,
                port: pending.port,
                username: credentials.username,
                password: credentials.password,
                domain: credentials.domain,
                width: size.width,
                height: size.height,
                dpi: RDP_DPI,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
            client = new Guacamole.Client(tunnel);
        } catch (err) {
            setState({ kind: "error", message: (err as Error).message });
            return;
        }

        const displayElement = client.getDisplay().getElement();
        displayElement.classList.add("ctr-guac-display");
        displayElement.tabIndex = 0;
        displayElement.setAttribute("role", "img");
        displayElement.setAttribute("aria-label", `${protocol.toUpperCase()} remote desktop display`);
        displayElement.addEventListener("mousedown", () => displayElement.focus());
        target.replaceChildren(displayElement);

        const keyboard = new Guacamole.Keyboard(displayElement);
        keyboard.onkeydown = keysym => {
            if (prefsRef.current.viewOnly)
                return true;
            client.sendKeyEvent(true, keysym);
            return false;
        };
        keyboard.onkeyup = keysym => {
            if (!prefsRef.current.viewOnly)
                client.sendKeyEvent(false, keysym);
        };
        keyboardRef.current = keyboard;

        const mouse = new Guacamole.Mouse(displayElement);
        mouse.onEach(["mousedown", "mouseup", "mousemove"], (event: GuacamoleMouseEvent) => {
            if (!prefsRef.current.viewOnly)
                client.sendMouseState(event.state, true);
        });

        resizeObserverRef.current = new ResizeObserver(() => {
            const next = displaySize(target);
            client.sendSize(next.width, next.height);
            applyScale();
        });
        resizeObserverRef.current.observe(target);

        tunnel.onerror = status => {
            const message = statusMessage(status);
            teardown();
            setState({ kind: "error", message: `The ${protocol.toUpperCase()} gateway rejected the connection: ${message}.` });
        };

        client.onerror = status => {
            failureRef.current = statusMessage(status);
        };

        client.onsync = () => applyScale();

        client.onstatechange = guacState => {
            if (guacState === Guacamole.Client.State.CONNECTED) {
                clearConnectTimeout();
                everConnectedRef.current = true;
                pendingTargetRef.current = null;
                applyScale();
                setState({ kind: "connected" });
                return;
            }

            if (guacState === Guacamole.Client.State.DISCONNECTED) {
                const failure = failureRef.current;
                const everConnected = everConnectedRef.current;
                const clean = intentionalDisconnectRef.current;
                teardown();
                if (failure)
                    setState({ kind: "error", message: `The ${protocol.toUpperCase()} server rejected the connection: ${failure}.` });
                else if (!everConnected)
                    setState({
                        kind: "error",
                        message: `Could not reach ${protocol.toUpperCase()} at ${pending.address}:${pending.port} through guacd. ` +
                            "Check on the Dashboard that both services are running and listening.",
                    });
                else
                    setState({ kind: "disconnected", clean });
            }
        };

        clientRef.current = client;
        setState({ kind: "connecting" });
        armConnectTimeout();
        try {
            client.connect();
        } catch (err) {
            teardown();
            setState({ kind: "error", message: (err as Error).message });
        }
    }, [armConnectTimeout, applyScale, clearConnectTimeout, container, protocol, teardown]);

    const disconnect = useCallback(() => {
        pendingTargetRef.current = null;
        intentionalDisconnectRef.current = true;
        if (!clientRef.current) {
            teardown();
            setState({ kind: "idle" });
            return;
        }
        clientRef.current.disconnect();
    }, [teardown]);

    const sendCtrlAltDel = useCallback(() => {
        const client = clientRef.current;
        if (!client || prefsRef.current.viewOnly)
            return;
        client.sendKeyEvent(true, CTRL);
        client.sendKeyEvent(true, ALT);
        client.sendKeyEvent(true, DELETE);
        client.sendKeyEvent(false, DELETE);
        client.sendKeyEvent(false, ALT);
        client.sendKeyEvent(false, CTRL);
    }, []);

    useEffect(() => teardown, [teardown]);

    return { state, connect, disconnect, sendCredentials, sendCtrlAltDel };
}
