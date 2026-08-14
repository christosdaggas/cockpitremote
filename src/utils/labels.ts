/*
 * systemd's own vocabulary, rendered for reading. Kept out of the components so
 * the health checks — which are pure and unit-tested — can use it too.
 */

import { _ } from "../i18n";

/**
 * The raw state still decides colours and logic everywhere; this only affects
 * what is shown, and an unrecognised state falls through to itself rather than
 * being swallowed.
 */
export function activeStateText(state: string): string {
    switch (state) {
    case "active":
        return _("active");
    case "failed":
        return _("failed");
    case "activating":
        return _("activating");
    case "deactivating":
        return _("deactivating");
    case "inactive":
        return _("inactive");
    default:
        return state;
    }
}
