import {
    DescriptionList,
    DescriptionListDescription,
    DescriptionListGroup,
    DescriptionListTerm,
} from "@patternfly/react-core";

import type { HealthCheck } from "../types";
import { HealthLabel } from "./common/StatusLabel";

export function HealthChecks({ checks }: { checks: HealthCheck[] }) {
    return (
        <DescriptionList isHorizontal isCompact>
            {checks.map(check => (
                <DescriptionListGroup key={check.id}>
                    <DescriptionListTerm>{check.label}</DescriptionListTerm>
                    <DescriptionListDescription id={check.id}>
                        <HealthLabel state={check.state} text={check.state.toUpperCase()} />{" "}
                        {check.detail}
                    </DescriptionListDescription>
                </DescriptionListGroup>
            ))}
        </DescriptionList>
    );
}
