import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import RFB from "@novnc/novnc/lib/rfb";

import { CONNECT_TIMEOUT_MS } from "../constants";
import { buildConsoleUrl } from "../services/channel";
import type { UiPrefs } from "../types";

export type ConsoleState =
    | { kind: "idle" }
    | { kind: "connecting" }
    | { kind: "credentials"; message: string | null }
    | { kind: "connected" }
    | { kind: "disconnected"; clean: boolean }
    | { kind: "error"; message: string };

export interface RfbControls {
    state: ConsoleState;
    connect: (port: number, address: string) => void;
    disconnect: () => void;
    sendCredentials: (password: string) => void;
    sendCtrlAltDel: () => void;
}

/*
 * Owns the full RFB lifecycle. The RFB instance lives in a ref (it is mutable
 * and non-serializable); React state only ever holds the serializable
 * ConsoleState the UI renders from.
 */
export function useRfb(container: RefObject<HTMLDivElement>, prefs: UiPrefs): RfbControls {
    const [state, setState] = useState<ConsoleState>({ kind: "idle" });
    const rfbRef = useRef<RFB | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const listenersRef = useRef<Array<[string, EventListener]>>([]);
    const securityFailureRef = useRef<string | null>(null);
    const everConnectedRef = useRef(false);
    const prefsRef = useRef(prefs);
    prefsRef.current = prefs;

    const clearConnectTimeout = useCallback(() => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const teardown = useCallback(() => {
        clearConnectTimeout();
        const rfb = rfbRef.current;
        rfbRef.current = null;
        if (rfb) {
            // Listeners are removed before disconnect() so the resulting
            // disconnect event cannot set state after teardown.
            for (const [event, listener] of listenersRef.current)
                rfb.removeEventListener(event, listener);
            listenersRef.current = [];
            try {
                rfb.disconnect();
            } catch {
                // already closed
            }
        }
    }, [clearConnectTimeout]);

    const applyPrefs = useCallback((rfb: RFB) => {
        const p = prefsRef.current;
        rfb.viewOnly = p.viewOnly;
        rfb.scaleViewport = p.scaleViewport;
        rfb.qualityLevel = p.qualityLevel;
        rfb.compressionLevel = p.compressionLevel;
        rfb.resizeSession = false;
    }, []);

    // Keep a live connection in sync when the user changes preferences.
    useEffect(() => {
        if (rfbRef.current)
            applyPrefs(rfbRef.current);
    }, [prefs, applyPrefs]);

    const armConnectTimeout = useCallback(() => {
        clearConnectTimeout();
        timeoutRef.current = window.setTimeout(() => {
            teardown();
            setState({
                kind: "error",
                message: `The VNC server did not respond within ${CONNECT_TIMEOUT_MS / 1000} seconds.`,
            });
        }, CONNECT_TIMEOUT_MS);
    }, [clearConnectTimeout, teardown]);

    const connect = useCallback((port: number, address: string) => {
        teardown();
        securityFailureRef.current = null;
        everConnectedRef.current = false;

        const target = container.current;
        if (!target) {
            setState({ kind: "error", message: "The console area is not ready yet. Try again." });
            return;
        }

        let rfb: RFB;
        try {
            rfb = new RFB(target, buildConsoleUrl(port, address), {});
        } catch (err) {
            setState({ kind: "error", message: (err as Error).message });
            return;
        }

        const on = (event: string, listener: EventListener) => {
            rfb.addEventListener(event, listener);
            listenersRef.current.push([event, listener]);
        };

        on("connect", () => {
            clearConnectTimeout();
            everConnectedRef.current = true;
            applyPrefs(rfb);
            setState({ kind: "connected" });
        });

        on("credentialsrequired", () => {
            clearConnectTimeout();
            setState({ kind: "credentials", message: null });
        });

        on("securityfailure", ((e: CustomEvent<{ reason?: string }>) => {
            securityFailureRef.current = e.detail?.reason ?? "authentication failed";
        }) as EventListener);

        on("disconnect", ((e: CustomEvent<{ clean?: boolean }>) => {
            const clean = e.detail?.clean === true;
            const failure = securityFailureRef.current;
            const everConnected = everConnectedRef.current;
            teardown();
            if (failure)
                setState({ kind: "error", message: `The VNC server rejected the connection: ${failure}.` });
            else if (!everConnected)
                setState({
                    kind: "error",
                    message: `Could not reach the VNC server at ${address}:${port}. ` +
                        "Check on the Dashboard that the service is running and listening.",
                });
            else
                setState({ kind: "disconnected", clean });
        }) as EventListener);

        rfbRef.current = rfb;
        applyPrefs(rfb);
        setState({ kind: "connecting" });
        armConnectTimeout();
    }, [container, teardown, applyPrefs, armConnectTimeout, clearConnectTimeout]);

    const disconnect = useCallback(() => {
        // The disconnect event listener performs the state transition.
        rfbRef.current?.disconnect();
    }, []);

    const sendCredentials = useCallback((password: string) => {
        const rfb = rfbRef.current;
        if (!rfb)
            return;
        setState({ kind: "connecting" });
        armConnectTimeout();
        rfb.sendCredentials({ password });
    }, [armConnectTimeout]);

    const sendCtrlAltDel = useCallback(() => {
        rfbRef.current?.sendCtrlAltDel();
    }, []);

    // Drop the connection when the component unmounts.
    useEffect(() => teardown, [teardown]);

    return { state, connect, disconnect, sendCredentials, sendCtrlAltDel };
}
