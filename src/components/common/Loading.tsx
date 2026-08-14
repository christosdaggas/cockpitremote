// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

import { Bullseye, Spinner } from "@patternfly/react-core";

import { _ } from "../../i18n";

export function Loading({ text }: { text?: string }) {
    return (
        <Bullseye className="ctr-loading">
            <Spinner size="xl" aria-label={text ?? _("Loading")} />
            {text && <span className="ctr-loading-text">{text}</span>}
        </Bullseye>
    );
}
