// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

import { describe, expect, it } from "vitest";

import { createClipboardCollector } from "../src/hooks/useGuacd";

describe("createClipboardCollector", () => {
    it("joins the chunks of a normal selection", () => {
        const collector = createClipboardCollector(32);
        expect(collector.add("hello ")).toBe(false);
        expect(collector.add("world")).toBe(false);
        expect(collector.text()).toBe("hello world");
    });

    it("keeps a selection that lands exactly on the cap", () => {
        const collector = createClipboardCollector(4);
        expect(collector.add("abcd")).toBe(false);
        expect(collector.text()).toBe("abcd");
    });

    it("drops the selection rather than truncating it once past the cap", () => {
        const collector = createClipboardCollector(4);
        collector.add("abc");
        expect(collector.add("de")).toBe(true);
        expect(collector.text()).toBe("");
    });

    /*
     * The stream is refused once, on the chunk that crosses the cap. Blobs
     * already in flight still arrive, and acknowledging each of them would
     * send a burst of redundant instructions back to guacd.
     */
    it("signals the refusal only once, however much more arrives", () => {
        const collector = createClipboardCollector(4);
        expect(collector.add("abcde")).toBe(true);
        expect(collector.add("fghij")).toBe(false);
        expect(collector.add("klmno")).toBe(false);
        expect(collector.text()).toBe("");
    });

    it("cannot be revived by a small chunk after overflowing", () => {
        const collector = createClipboardCollector(4);
        collector.add("abcde");
        collector.add("x");
        expect(collector.text()).toBe("");
    });
});
