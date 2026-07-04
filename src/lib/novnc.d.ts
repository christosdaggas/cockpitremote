// Minimal type declarations for noVNC 1.5.x (ships no TypeScript types).
declare module "@novnc/novnc/lib/rfb" {
    export interface RFBCredentials {
        username?: string;
        password?: string;
        target?: string;
    }

    export interface RFBOptions {
        shared?: boolean;
        credentials?: RFBCredentials;
        repeaterID?: string;
        wsProtocols?: string[];
    }

    export default class RFB extends EventTarget {
        constructor(target: Element, urlOrChannel: string | object, options?: RFBOptions);

        viewOnly: boolean;
        scaleViewport: boolean;
        resizeSession: boolean;
        clipViewport: boolean;
        dragViewport: boolean;
        qualityLevel: number;
        compressionLevel: number;
        showDotCursor: boolean;
        background: string;
        readonly capabilities: { power: boolean };

        sendCredentials(credentials: RFBCredentials): void;
        sendCtrlAltDel(): void;
        sendKey(keysym: number, code: string | null, down?: boolean): void;
        disconnect(): void;
        focus(): void;
        blur(): void;
        clipboardPasteFrom(text: string): void;
        machineShutdown(): void;
        machineReboot(): void;
        machineReset(): void;
    }
}
