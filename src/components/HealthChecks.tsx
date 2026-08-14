import {
    DescriptionList,
    DescriptionListDescription,
    DescriptionListGroup,
    DescriptionListTerm,
} from "@patternfly/react-core";

import { _ } from "../i18n";
import type { HealthCheck, HealthState } from "../types";
import { HealthLabel } from "./common/StatusLabel";

/** Upper case is a styling choice in English; other languages set their own. */
function stateText(state: HealthState): string {
    switch (state) {
    case "ok":
        return _("OK");
    case "warning":
        return _("WARNING");
    case "error":
        return _("ERROR");
    default:
        return _("UNKNOWN");
    }
}

export function HealthChecks({ checks }: { checks: HealthCheck[] }) {
    return (
        <DescriptionList isHorizontal isCompact>
            {checks.map(check => (
                <DescriptionListGroup key={check.id}>
                    <DescriptionListTerm>{check.label}</DescriptionListTerm>
                    <DescriptionListDescription id={check.id}>
                        <HealthLabel state={check.state} text={stateText(check.state)} />{" "}
                        {check.detail}
                    </DescriptionListDescription>
                </DescriptionListGroup>
            ))}
        </DescriptionList>
    );
}
