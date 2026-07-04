import { useState, type ReactNode } from "react";
import { Button, Modal, ModalVariant } from "@patternfly/react-core";

export interface ConfirmDialogProps {
    title: string;
    isOpen: boolean;
    confirmLabel: string;
    /** "danger" styles the confirm button for destructive actions. */
    variant?: "danger" | "primary";
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
    children: ReactNode;
}

export function ConfirmDialog({ title, isOpen, confirmLabel, variant = "primary", onClose, onConfirm, children }: ConfirmDialogProps) {
    const [busy, setBusy] = useState(false);

    const handleConfirm = async () => {
        setBusy(true);
        try {
            await onConfirm();
        } finally {
            setBusy(false);
            onClose();
        }
    };

    return (
        <Modal
            variant={ModalVariant.small}
            title={title}
            titleIconVariant={variant === "danger" ? "warning" : undefined}
            isOpen={isOpen}
            onClose={busy ? undefined : onClose}
            actions={[
                <Button key="confirm" variant={variant} onClick={handleConfirm}
                        isLoading={busy} isDisabled={busy}>
                    {confirmLabel}
                </Button>,
                <Button key="cancel" variant="link" onClick={onClose} isDisabled={busy}>
                    Cancel
                </Button>,
            ]}
        >
            {children}
        </Modal>
    );
}
