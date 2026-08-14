// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Guacamole, {
    type GuacamoleClient,
    type GuacamoleKeyboard,
    type GuacamoleKeyboardModifiers,
    type GuacamoleMouseEvent,
    type GuacamoleStatus,
} from "guacamole-common-js";

import { CLIPBOARD_MAX_CHARS, CONNECT_TIMEOUT_MS, RDP_DPI } from "../constants";
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
    /**
     * The last selection copied on the remote desktop. Held here because
     * Firefox only lets the page write the local clipboard while handling a
     * user gesture, so the automatic write silently fails there and the text
     * has to stay available for a button to copy on demand.
     */
    remoteClipboard: string;
    /** Sends text to the remote clipboard without needing a paste shortcut. */
    sendClipboard: (text: string) => void;
}

const CTRL = 0xffe3;
const ALT = 0xffe9;
const DELETE = 0xffff;
const KEY_V_LOWER = 0x0076;
const KEY_V_UPPER = 0x0056;

/**
 * How long to wait for the browser's "paste" event after a paste shortcut
 * before giving up and forwarding the shortcut anyway. The event normally
 * arrives within a millisecond or two; the wait only matters when the browser
 * suppresses it, in which case the remote still pastes its own clipboard as it
 * did before clipboard sync existed.
 */
const PASTE_EVENT_GRACE_MS = 150;

function statusMessage(status: GuacamoleStatus): string {
    return status.message || `Guacamole error ${status.code}`;
}

/** Ctrl+V, Ctrl+Shift+V, and the macOS Cmd+V equivalent. */
function isPasteShortcut(modifiers: GuacamoleKeyboardModifiers, keysym: number): boolean {
    if (modifiers.alt || (keysym !== KEY_V_LOWER && keysym !== KEY_V_UPPER))
        return false;
    return modifiers.ctrl || modifiers.meta;
}

export interface ClipboardCollector {
    /** Adds a chunk; true exactly once, on the chunk that crosses the cap. */
    add: (chunk: string) => boolean;
    /** The collected selection, or "" once the cap was crossed. */
    text: () => string;
}

/**
 * Gathers a remote clipboard selection, giving up if it grows past
 * CLIPBOARD_MAX_CHARS. What has been collected is dropped at that point rather
 * than truncated: half a selection pasted into the local clipboard would be
 * worse than none.
 */
export function createClipboardCollector(limit = CLIPBOARD_MAX_CHARS): ClipboardCollector {
    let text = "";
    let overflowed = false;
    return {
        add(chunk) {
            if (overflowed)
                return false;
            if (text.length + chunk.length > limit) {
                overflowed = true;
                text = "";
                return true;
            }
            text += chunk;
            return false;
        },
        text: () => text,
    };
}

function sendClipboardText(client: GuacamoleClient, text: string): void {
    const writer = new Guacamole.StringWriter(client.createClipboardStream("text/plain"));
    writer.sendText(text);
    writer.sendEnd();
}

/**
 * The console box measured on its content edge.
 *
 * getBoundingClientRect() reports the border box, which still counts the space
 * taken by a visible scrollbar. Scaling the display from that number hands it
 * more room than it really has, so the picture overhangs by the scrollbar's
 * width and the scrollbar can never go away — each resize pushes it further
 * out. clientWidth/clientHeight leave the scrollbars out, and being integers
 * they also let the remote resolution match the box exactly, which keeps the
 * image at 1:1 instead of resampling it by a fraction of a pixel.
 */
function consoleBox(container: HTMLDivElement): { width: number; height: number } {
    return { width: container.clientWidth, height: container.clientHeight };
}

function displaySize(container: HTMLDivElement): { width: number; height: number } {
    const box = consoleBox(container);
    return {
        width: Math.max(640, box.width || 1280),
        height: Math.max(480, box.height || 800),
    };
}

export function useGuacd(container: RefObject<HTMLDivElement>, prefs: UiPrefs, protocol: GuacdProtocol = "rdp"): GuacdControls {
    const [state, setState] = useState<ConsoleState>({ kind: "idle" });
    const [remoteClipboard, setRemoteClipboard] = useState("");
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
    /** Last applied scale plus the measurements it was derived from. */
    const scaleCacheRef = useRef({ scale: 0, width: 0, height: 0, boxWidth: 0, boxHeight: 0 });

    const clearConnectTimeout = useCallback(() => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    /**
     * Scaling runs once per synced frame, so it must not touch layout unless
     * something actually changed: measuring the box forces a reflow, and
     * Guacamole's scale() rewrites three inline styles. The console box only
     * ever resizes through the ResizeObserver, so its measurement is cached and
     * refreshed on demand, and the scale itself is written only when it (or the
     * remote resolution behind it) really moved.
     */
    const applyScale = useCallback((remeasure = false) => {
        const client = clientRef.current;
        const target = container.current;
        if (!client || !target)
            return;

        const display = client.getDisplay();
        const width = display.getWidth();
        const height = display.getHeight();
        const cache = scaleCacheRef.current;

        if (remeasure || !cache.boxWidth || !cache.boxHeight) {
            const box = consoleBox(target);
            cache.boxWidth = box.width;
            cache.boxHeight = box.height;
        }

        let scale = 1;
        if (width && height && prefsRef.current.scaleViewport) {
            const fit = Math.min(cache.boxWidth / width, cache.boxHeight / height);
            scale = Number.isFinite(fit) ? Math.max(0.1, fit) : 1;
        }

        // The remote resolution is part of the check because scale() also sizes
        // the bounds box from it, so an unchanged scale can still be stale.
        if (scale === cache.scale && width === cache.width && height === cache.height)
            return;
        cache.scale = scale;
        cache.width = width;
        cache.height = height;
        display.scale(scale);
    }, [container]);

    const teardown = useCallback(() => {
        clearConnectTimeout();
        // One session's copied text must not linger in the next session's panel.
        setRemoteClipboard("");
        resizeObserverRef.current?.disconnect();
        resizeObserverRef.current = null;
        // Drop the cached geometry so the next session measures afresh.
        scaleCacheRef.current = { scale: 0, width: 0, height: 0, boxWidth: 0, boxHeight: 0 };

        keyboardRef.current?.reset();

        const client = clientRef.current;
        clientRef.current = null;
        if (client) {
            client.onstatechange = null;
            client.onerror = null;
            client.onsync = null;
            client.onclipboard = null;
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
        // Remeasure: toggling the preference also switches the box between
        // hidden and scrolling overflow, which changes the room it has.
        applyScale(true);
    }, [prefs.scaleViewport, applyScale]);

    useEffect(() => {
        const target = container.current;
        if (!target)
            return;

        // Guacamole recommends document-level capture because browsers do not
        // consistently direct printable keypress/composition events to a div.
        const keyboard = new Guacamole.Keyboard(document);
        const forwardedKeys = new Set<number>();
        const hasConsoleFocus = () => document.activeElement === target || target.contains(document.activeElement);

        // A paste shortcut is held back rather than forwarded immediately: the
        // browser only hands over the local clipboard through its own "paste"
        // event, and that event never fires if the keystroke is swallowed. The
        // shortcut is replayed to the remote once the clipboard has gone out,
        // so the remote pastes what the user actually copied locally.
        let pendingPaste: number | null = null;
        let pasteTimeout: number | null = null;

        const flushPendingPaste = () => {
            if (pasteTimeout !== null) {
                window.clearTimeout(pasteTimeout);
                pasteTimeout = null;
            }
            const keysym = pendingPaste;
            pendingPaste = null;
            const client = clientRef.current;
            if (keysym === null || !client || prefsRef.current.viewOnly)
                return;
            client.sendKeyEvent(1, keysym);
            client.sendKeyEvent(0, keysym);
        };

        keyboard.onkeydown = keysym => {
            const client = clientRef.current;
            if (!client || !hasConsoleFocus() || prefsRef.current.viewOnly)
                return true;

            if (isPasteShortcut(keyboard.modifiers, keysym)) {
                flushPendingPaste();
                pendingPaste = keysym;
                pasteTimeout = window.setTimeout(flushPendingPaste, PASTE_EVENT_GRACE_MS);
                return true;
            }

            forwardedKeys.add(keysym);
            client.sendKeyEvent(1, keysym);
            return false;
        };
        keyboard.onkeyup = keysym => {
            const client = clientRef.current;
            if (client && forwardedKeys.delete(keysym))
                client.sendKeyEvent(0, keysym);
        };

        const handlePaste = (event: ClipboardEvent) => {
            const client = clientRef.current;
            if (!client || !hasConsoleFocus() || prefsRef.current.viewOnly)
                return;
            const text = event.clipboardData?.getData("text/plain");
            try {
                if (text)
                    sendClipboardText(client, text);
            } catch {
                // Stream refused; fall through and let the remote paste its own
                // clipboard rather than dropping the keystroke entirely.
            }
            // guacd processes instructions in order, so the clipboard is
            // already buffered there by the time the shortcut arrives.
            flushPendingPaste();
        };

        const resetKeyboard = () => {
            if (pasteTimeout !== null) {
                window.clearTimeout(pasteTimeout);
                pasteTimeout = null;
            }
            pendingPaste = null;
            keyboard.reset();
            forwardedKeys.clear();
        };
        document.addEventListener("paste", handlePaste, true);
        target.addEventListener("blur", resetKeyboard);
        window.addEventListener("blur", resetKeyboard);
        keyboardRef.current = keyboard;

        return () => {
            if (pasteTimeout !== null)
                window.clearTimeout(pasteTimeout);
            keyboard.reset();
            keyboard.onkeydown = null;
            keyboard.onkeyup = null;
            document.removeEventListener("paste", handlePaste, true);
            target.removeEventListener("blur", resetKeyboard);
            window.removeEventListener("blur", resetKeyboard);
            if (keyboardRef.current === keyboard)
                keyboardRef.current = null;
        };
    }, [container]);

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
                // Connect-time parameters: changing them takes effect on the
                // next connection, not the running session.
                qualityLevel: prefsRef.current.qualityLevel,
                compressionLevel: prefsRef.current.compressionLevel,
            });
            client = new Guacamole.Client(tunnel);
        } catch (err) {
            setState({ kind: "error", message: (err as Error).message });
            return;
        }

        const displayElement = client.getDisplay().getElement();
        displayElement.classList.add("ctr-guac-display");
        displayElement.setAttribute("role", "img");
        displayElement.setAttribute("aria-label", `${protocol.toUpperCase()} remote desktop display`);
        target.replaceChildren(displayElement);

        const mouse = new Guacamole.Mouse(displayElement);
        mouse.onEach(["mousedown", "mouseup", "mousemove"], (event: GuacamoleMouseEvent) => {
            if (!prefsRef.current.viewOnly)
                client.sendMouseState(event.state, true);
        });

        resizeObserverRef.current = new ResizeObserver(() => {
            const next = displaySize(target);
            client.sendSize(next.width, next.height);
            applyScale(true);
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

        client.onclipboard = (stream, mimetype) => {
            if (!mimetype.startsWith("text/")) {
                stream.sendAck("Only text clipboard data is supported", 0x030f);
                return;
            }
            const reader = new Guacamole.StringReader(stream);
            const collector = createClipboardCollector();
            reader.ontext = chunk => {
                // Refusing the stream once, on the blob that crosses the cap:
                // blobs already in flight still arrive and must not re-ack.
                if (collector.add(chunk))
                    stream.sendAck("Clipboard selection is too large", 0x030d);
            };
            reader.onend = () => {
                const text = collector.text();
                if (!text)
                    return;
                // Kept regardless of what the browser allows, so the toolbar
                // can offer it behind a button.
                setRemoteClipboard(text);
                // Best effort: browsers may refuse a clipboard write that is
                // not tied to a user gesture, in which case the remote
                // selection simply stays on the remote.
                navigator.clipboard?.writeText(text).catch(() => {});
            };
        };

        client.onsync = () => applyScale();

        client.onstatechange = guacState => {
            if (guacState === Guacamole.Client.State.CONNECTED) {
                clearConnectTimeout();
                everConnectedRef.current = true;
                pendingTargetRef.current = null;
                applyScale();
                setState({ kind: "connected" });
                target.focus({ preventScroll: true });
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
        client.sendKeyEvent(1, CTRL);
        client.sendKeyEvent(1, ALT);
        client.sendKeyEvent(1, DELETE);
        client.sendKeyEvent(0, DELETE);
        client.sendKeyEvent(0, ALT);
        client.sendKeyEvent(0, CTRL);
    }, []);

    const sendClipboard = useCallback((text: string) => {
        const client = clientRef.current;
        if (!client || !text)
            return;
        sendClipboardText(client, text);
    }, []);

    useEffect(() => teardown, [teardown]);

    return { state, connect, disconnect, sendCredentials, sendCtrlAltDel, remoteClipboard, sendClipboard };
}
