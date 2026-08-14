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
