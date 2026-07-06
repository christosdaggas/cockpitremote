import { useState } from "react";
import {
    Alert,
    Button,
    Form,
    FormGroup,
    FormHelperText,
    HelperText,
    HelperTextItem,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    TextInput,
} from "@patternfly/react-core";

import { useNotify } from "../notifications";
import { setGrdVncPassword } from "../services/vncpassword";
import type { BackendId } from "../types";
import { isCancelled, toUserMessage } from "../utils/errors";
import { validatePassword, ValidationError } from "../utils/validation";

export interface PasswordModalProps {
    backend: BackendId;
    isOpen: boolean;
    onClose: () => void;
    onUpdated?: () => Promise<void> | void;
}

/*
 * Sets GNOME Remote Desktop's VNC password. The password only lives in this
 * component's state while the modal is open, is sent on stdin, and is cleared
 * as soon as the request finishes. It never reaches an argv or a log.
 */
export function PasswordModal({ backend, isOpen, onClose, onUpdated }: PasswordModalProps) {
    const notify = useNotify();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    let warning: string | null = null;
    try {
        if (password)
            warning = validatePassword(password).warning;
    } catch (err) {
        warning = (err as ValidationError).message;
    }

    const mismatch = confirm.length > 0 && confirm !== password;
    const canSubmit = password.length > 0 && confirm === password && !busy;

    const reset = () => {
        setPassword("");
        setConfirm("");
        setError(null);
    };

    const close = () => {
        reset();
        onClose();
    };

    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            if (backend === "grd") {
                await setGrdVncPassword(password);
                notify("success", "GNOME Remote Desktop updated",
                       "VNC password authentication is enabled; new connections will not require approval on the host desktop.");
            } else {
                throw new ValidationError(`Password management is not supported for ${backend}.`);
            }
            await onUpdated?.();
            close();
        } catch (err) {
            if (isCancelled(err))
                close();
            else
                setError(toUserMessage(err, "Could not set the password"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            className="ctr-password-modal"
            width="35rem"
            maxWidth="calc(100vw - 2rem)"
            aria-labelledby="ctr-password-modal-title"
            isOpen={isOpen}
            onClose={busy ? undefined : close}
        >
            <ModalHeader title="Set VNC password" labelId="ctr-password-modal-title" />
            <ModalBody>
                <Form>
                    {error && <Alert variant="danger" isInline title={error} />}
                    {backend === "grd" && (
                        <Alert variant="info" isInline isPlain
                               title="This switches GNOME Remote Desktop VNC from desktop approval prompts to password authentication for the current Cockpit user." />
                    )}
                    <FormGroup label="New VNC password" fieldId="ctr-new-password" isRequired>
                        <TextInput
                            id="ctr-new-password"
                            type="password"
                            value={password}
                            onChange={(_event, value) => setPassword(value)}
                            autoComplete="new-password"
                            aria-label="New VNC password"
                        />
                        {warning && (
                            <FormHelperText>
                                <HelperText>
                                    <HelperTextItem variant="warning">{warning}</HelperTextItem>
                                </HelperText>
                            </FormHelperText>
                        )}
                    </FormGroup>
                    <FormGroup label="Confirm password" fieldId="ctr-confirm-password" isRequired>
                        <TextInput
                            id="ctr-confirm-password"
                            type="password"
                            value={confirm}
                            onChange={(_event, value) => setConfirm(value)}
                            autoComplete="new-password"
                            validated={mismatch ? "error" : "default"}
                            aria-label="Confirm VNC password"
                        />
                        {mismatch && (
                            <FormHelperText>
                                <HelperText>
                                    <HelperTextItem variant="error">Passwords do not match.</HelperTextItem>
                                </HelperText>
                            </FormHelperText>
                        )}
                    </FormGroup>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" onClick={submit} isDisabled={!canSubmit} isLoading={busy}>
                    Set password
                </Button>
                <Button variant="link" onClick={close} isDisabled={busy}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}
