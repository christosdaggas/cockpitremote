import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCockpit = vi.hoisted((): {
    transport?: {
        csrf_token: string;
        host: string | null;
        uri: (suffix?: string) => string;
    };
} => ({}));

vi.mock("../src/lib/cockpit", () => ({ default: mockCockpit }));

import { ChannelUnsupportedError, buildConsoleUrl, channelTransportAvailable } from "../src/services/channel";
import { ValidationError } from "../src/utils/validation";

function installTransport(host: string | null = null) {
    mockCockpit.transport = {
        csrf_token: "token123",
        host,
        uri: (suffix?: string) => `wss://server.example:9090/cockpit/${suffix ?? ""}`,
    };
}

describe("buildConsoleUrl", () => {
    beforeEach(() => {
        installTransport();
    });

    it("builds the cockpit-machines-style channel WebSocket URL", () => {
        // jsdom's default location is http://localhost:3000/
        const url = buildConsoleUrl(5900);
        expect(url.startsWith("ws://localhost:3000/cockpit/channel/token123?")).toBe(true);

        const query = url.split("?")[1];
        const options = JSON.parse(window.atob(query));
        expect(options).toEqual({
            payload: "stream",
            binary: "raw",
            address: "127.0.0.1",
            port: 5900,
        });
        // The port must be a JSON number, not a string.
        expect(typeof options.port).toBe("number");
    });

    it("includes the remote host for multi-host routing when set", () => {
        installTransport("machine2");
        const options = JSON.parse(window.atob(buildConsoleUrl(5900, "127.0.0.1").split("?")[1]));
        expect(options.host).toBe("machine2");
    });

    it("validates port and address before building anything", () => {
        expect(() => buildConsoleUrl(0)).toThrow(ValidationError);
        expect(() => buildConsoleUrl(70000)).toThrow(ValidationError);
        expect(() => buildConsoleUrl(5900, "evil.example.com; reboot")).toThrow(ValidationError);
    });

    it("throws a clear error when the transport API is unavailable", () => {
        mockCockpit.transport = undefined;
        expect(channelTransportAvailable()).toBe(false);
        expect(() => buildConsoleUrl(5900)).toThrow(ChannelUnsupportedError);
    });
});
