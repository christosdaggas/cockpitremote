import { useState } from "react";
import { Button, Flex, FlexItem } from "@patternfly/react-core";

import { _, format } from "../i18n";
import { useNotify } from "../notifications";
import { serviceAction } from "../services/systemd";
import type { ServiceStatus, SystemdAction, UnitScope } from "../types";
import { isCancelled, toUserMessage } from "../utils/errors";
import { ConfirmDialog } from "./common/ConfirmDialog";

export interface ServiceActionsProps {
    unit: string;
    scope: UnitScope;
    status: ServiceStatus | null;
    onRefresh: () => Promise<void>;
}

/**
 * Actions that can interrupt a live desktop session require confirmation. Built
 * on demand rather than as a constant so the text follows the loaded language.
 */
function confirmationFor(action: SystemdAction): { title: string; body: string } | undefined {
    switch (action) {
    case "stop":
        return {
            title: _("Stop VNC service?"),
            body: _("Stopping the service will immediately terminate any active remote desktop session."),
        };
    case "restart":
        return {
            title: _("Restart VNC service?"),
            body: _("Restarting the service will briefly interrupt any active remote desktop session."),
        };
    case "disable":
        return {
            title: _("Disable on boot?"),
            body: _("The service will no longer start automatically after a reboot. It keeps running for now."),
        };
    default:
        return undefined;
    }
}

/** systemd verbs as the buttons and toasts should read them. */
function actionText(action: SystemdAction): string {
    switch (action) {
    case "start":
        return _("Start");
    case "stop":
        return _("Stop");
    case "restart":
        return _("Restart");
    case "enable":
        return _("Enable");
    default:
        return _("Disable");
    }
}

export function ServiceActions({ unit, scope, status, onRefresh }: ServiceActionsProps) {
    const notify = useNotify();
    const [busy, setBusy] = useState<SystemdAction | null>(null);
    const [pendingConfirm, setPendingConfirm] = useState<SystemdAction | null>(null);

    const run = async (action: SystemdAction) => {
        setBusy(action);
        try {
            await serviceAction(action, unit, scope);
            notify("success", format(_("$0 succeeded"), actionText(action)), unit);
        } catch (err) {
            if (!isCancelled(err))
                notify("danger", format(_("Could not $0 $1"), actionText(action).toLowerCase(), unit), toUserMessage(err));
        } finally {
            setBusy(null);
            await onRefresh();
        }
    };

    const request = (action: SystemdAction) => {
        if (confirmationFor(action))
            setPendingConfirm(action);
        else
            run(action);
    };

    const active = status?.activeState === "active";
    const enabled = status?.unitFileState === "enabled";
    const exists = status?.exists ?? false;
    const disabledAll = !exists || busy !== null;
    const confirm = pendingConfirm ? confirmationFor(pendingConfirm) : undefined;

    return (
        <>
            <Flex className="ctr-service-actions" spaceItems={{ default: "spaceItemsSm" }}>
                <FlexItem>
                    <Button variant="primary" size="sm" isDisabled={disabledAll || active}
                            isLoading={busy === "start"} onClick={() => request("start")}>
                        {actionText("start")}
                    </Button>
                </FlexItem>
                <FlexItem>
                    <Button variant="secondary" size="sm" isDisabled={disabledAll || !active}
                            isLoading={busy === "restart"} onClick={() => request("restart")}>
                        {actionText("restart")}
                    </Button>
                </FlexItem>
                <FlexItem>
                    <Button variant="danger" size="sm" isDisabled={disabledAll || !active}
                            isLoading={busy === "stop"} onClick={() => request("stop")}>
                        {actionText("stop")}
                    </Button>
                </FlexItem>
                <FlexItem>
                    <Button variant="link" size="sm" isDisabled={disabledAll}
                            isLoading={busy === "enable" || busy === "disable"}
                            onClick={() => request(enabled ? "disable" : "enable")}>
                        {enabled ? _("Disable on boot") : _("Enable on boot")}
                    </Button>
                </FlexItem>
            </Flex>
            {pendingConfirm && confirm && (
                <ConfirmDialog
                    title={confirm.title}
                    isOpen
                    confirmLabel={actionText(pendingConfirm)}
                    variant={pendingConfirm === "disable" ? "primary" : "danger"}
                    onClose={() => setPendingConfirm(null)}
                    onConfirm={() => run(pendingConfirm)}
                >
                    {confirm.body}
                </ConfirmDialog>
            )}
        </>
    );
}
