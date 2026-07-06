// Minimal type declarations for guacamole-common-js 1.5.x (ships no TypeScript types).
declare module "guacamole-common-js" {
    export interface GuacamoleStatus {
        code: number;
        message: string;
        isError(): boolean;
    }

    export interface GuacamoleTunnel {
        state: number;
        receiveTimeout: number;
        unstableThreshold: number;
        uuid: string | null;
        onuuid: ((uuid: string) => void) | null;
        onerror: ((status: GuacamoleStatus) => void) | null;
        onstatechange: ((state: number) => void) | null;
        oninstruction: ((opcode: string, parameters: string[]) => void) | null;
        connect(data?: string): void;
        disconnect(): void;
        sendMessage(...elements: unknown[]): void;
        setState(state: number): void;
        setUUID(uuid: string): void;
        isConnected(): boolean;
    }

    export interface GuacamoleDisplay {
        getElement(): HTMLElement;
        getWidth(): number;
        getHeight(): number;
        getScale(): number;
        scale(scale: number): void;
    }

    export interface GuacamoleClient {
        onstatechange: ((state: number) => void) | null;
        onerror: ((status: GuacamoleStatus) => void) | null;
        onsync: ((timestamp: number, frames?: number) => void) | null;
        connect(data?: string): void;
        disconnect(): void;
        getDisplay(): GuacamoleDisplay;
        sendSize(width: number, height: number): void;
        sendKeyEvent(pressed: boolean, keysym: number): void;
        sendMouseState(mouseState: GuacamoleMouseState, applyDisplayScale?: boolean): void;
    }

    export interface GuacamoleMouseState {
        x: number;
        y: number;
        left: boolean;
        middle: boolean;
        right: boolean;
        up: boolean;
        down: boolean;
    }

    export interface GuacamoleMouseEvent {
        state: GuacamoleMouseState;
    }

    export interface GuacamoleMouse {
        on(type: string, listener: (event: GuacamoleMouseEvent) => void): void;
        onEach(types: string[], listener: (event: GuacamoleMouseEvent) => void): void;
    }

    export interface GuacamoleKeyboard {
        onkeydown: ((keysym: number) => boolean) | null;
        onkeyup: ((keysym: number) => void) | null;
        reset(): void;
    }

    export interface GuacamoleParser {
        oninstruction: ((opcode: string, parameters: string[]) => void) | null;
        receive(packet: string): void;
    }

    const Guacamole: {
        Tunnel: {
            new(): GuacamoleTunnel;
            State: {
                CONNECTING: number;
                OPEN: number;
                CLOSED: number;
                UNSTABLE: number;
            };
        };
        Client: {
            new(tunnel: GuacamoleTunnel): GuacamoleClient;
            State: {
                IDLE: number;
                CONNECTING: number;
                WAITING: number;
                CONNECTED: number;
                DISCONNECTING: number;
                DISCONNECTED: number;
            };
        };
        Status: {
            new(code: number, message?: string): GuacamoleStatus;
            Code: {
                SUCCESS: number;
                SERVER_ERROR: number;
                UPSTREAM_TIMEOUT: number;
                UPSTREAM_ERROR: number;
                UPSTREAM_UNAVAILABLE: number;
                RESOURCE_CLOSED: number;
                CLIENT_BAD_REQUEST: number;
            };
        };
        Parser: { new(): GuacamoleParser };
        Keyboard: { new(element?: Element | Document): GuacamoleKeyboard };
        Mouse: { new(element: Element): GuacamoleMouse };
    };

    export default Guacamole;
}
