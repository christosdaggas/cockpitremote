// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

import { Label } from "@patternfly/react-core";
import { CheckCircleIcon, ExclamationCircleIcon, ExclamationTriangleIcon, QuestionCircleIcon } from "@patternfly/react-icons";

import { _ } from "../../i18n";
import type { HealthState, ServiceStatus } from "../../types";
import { activeStateText } from "../../utils/labels";

const STATE_PROPS: Record<HealthState, { color: "green" | "red" | "gold" | "grey"; icon: JSX.Element }> = {
    ok: { color: "green", icon: <CheckCircleIcon /> },
    error: { color: "red", icon: <ExclamationCircleIcon /> },
    warning: { color: "gold", icon: <ExclamationTriangleIcon /> },
    unknown: { color: "grey", icon: <QuestionCircleIcon /> },
};

export function HealthLabel({ state, text }: { state: HealthState; text: string }) {
    const props = STATE_PROPS[state];
    return <Label color={props.color} icon={props.icon}>{text}</Label>;
}

export function ActiveLabel({ status }: { status: ServiceStatus | null }) {
    if (!status || !status.exists)
        return <Label color="grey">{_("no unit")}</Label>;
    switch (status.activeState) {
    case "active":
        return <Label color="green" icon={<CheckCircleIcon />}>{activeStateText("active")}</Label>;
    case "failed":
        return <Label color="red" icon={<ExclamationCircleIcon />}>{activeStateText("failed")}</Label>;
    case "activating":
    case "deactivating":
        return <Label color="gold">{activeStateText(status.activeState)}</Label>;
    default:
        return <Label color="grey">{activeStateText(status.activeState)}</Label>;
    }
}

export function EnabledLabel({ status }: { status: ServiceStatus | null }) {
    if (!status || !status.exists || !status.unitFileState)
        return null;
    const enabled = status.unitFileState === "enabled";
    return (
        <Label color={enabled ? "blue" : "grey"} variant="outline">
            {enabled ? _("starts on boot") : status.unitFileState}
        </Label>
    );
}
