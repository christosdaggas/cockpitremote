import { useState } from "react";
import { Button, Flex, FlexItem } from "@patternfly/react-core";

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

/** Actions that can interrupt a live desktop session require confirmation. */
const CONFIRMABLE: Partial<Record<SystemdAction, { title: string; body: string }>> = {
    stop: {
        title: "Stop VNC service?",
        body: "Stopping the service will immediately terminate any active remote desktop session.",
    },
    restart: {
        title: "Restart VNC service?",
        body: "Restarting the service will briefly interrupt any active remote desktop session.",
    },
    disable: {
        title: "Disable on boot?",
        body: "The service will no longer start automatically after a reboot. It keeps running for now.",
    },
};

export function ServiceActions({ unit, scope, status, onRefresh }: ServiceActionsProps) {
    const notify = useNotify();
    const [busy, setBusy] = useState<SystemdAction | null>(null);
    const [pendingConfirm, setPendingConfirm] = useState<SystemdAction | null>(null);

    const run = async (action: SystemdAction) => {
        setBusy(action);
        try {
            await serviceAction(action, unit, scope);
            notify("success", `${capitalize(action)} succeeded`, unit);
        } catch (err) {
            if (!isCancelled(err))
                notify("danger", `Could not ${action} ${unit}`, toUserMessage(err));
        } finally {
            setBusy(null);
            await onRefresh();
        }
    };

    const request = (action: SystemdAction) => {
        if (CONFIRMABLE[action])
            setPendingConfirm(action);
        else
            run(action);
    };

    const active = status?.activeState === "active";
    const enabled = status?.unitFileState === "enabled";
    const exists = status?.exists ?? false;
    const disabledAll = !exists || busy !== null;
    const confirm = pendingConfirm ? CONFIRMABLE[pendingConfirm] : undefined;

    return (
        <>
            <Flex className="ctr-service-actions" spaceItems={{ default: "spaceItemsSm" }}>
                <FlexItem>
                    <Button variant="primary" size="sm" isDisabled={disabledAll || active}
                            isLoading={busy === "start"} onClick={() => request("start")}>
                        Start
                    </Button>
                </FlexItem>
                <FlexItem>
                    <Button variant="secondary" size="sm" isDisabled={disabledAll || !active}
                            isLoading={busy === "restart"} onClick={() => request("restart")}>
                        Restart
                    </Button>
                </FlexItem>
                <FlexItem>
                    <Button variant="danger" size="sm" isDisabled={disabledAll || !active}
                            isLoading={busy === "stop"} onClick={() => request("stop")}>
                        Stop
                    </Button>
                </FlexItem>
                <FlexItem>
                    <Button variant="link" size="sm" isDisabled={disabledAll}
                            isLoading={busy === "enable" || busy === "disable"}
                            onClick={() => request(enabled ? "disable" : "enable")}>
                        {enabled ? "Disable on boot" : "Enable on boot"}
                    </Button>
                </FlexItem>
            </Flex>
            {pendingConfirm && confirm && (
                <ConfirmDialog
                    title={confirm.title}
                    isOpen
                    confirmLabel={capitalize(pendingConfirm)}
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

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
