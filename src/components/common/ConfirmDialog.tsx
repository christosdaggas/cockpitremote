import { useState, type ReactNode } from "react";
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from "@patternfly/react-core";

import { _ } from "../../i18n";

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
            className="ctr-password-modal"
            width="35rem"
            maxWidth="calc(100vw - 2rem)"
            aria-labelledby="ctr-confirm-dialog-title"
            isOpen={isOpen}
            onClose={busy ? undefined : onClose}
        >
            <ModalHeader
                title={title}
                labelId="ctr-confirm-dialog-title"
                titleIconVariant={variant === "danger" ? "warning" : undefined}
            />
            <ModalBody>{children}</ModalBody>
            <ModalFooter>
                <Button variant={variant} onClick={handleConfirm} isLoading={busy} isDisabled={busy}>
                    {confirmLabel}
                </Button>
                <Button variant="link" onClick={onClose} isDisabled={busy}>
                    {_("Cancel")}
                </Button>
            </ModalFooter>
        </Modal>
    );
}
