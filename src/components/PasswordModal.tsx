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
    ModalVariant,
    TextInput,
} from "@patternfly/react-core";

import { useNotify } from "../notifications";
import { setTigervncUserPassword, setX11vncPassword } from "../services/vncpassword";
import type { BackendId } from "../types";
import { isCancelled, toUserMessage } from "../utils/errors";
import { validatePassword, ValidationError } from "../utils/validation";

export interface PasswordModalProps {
    backend: BackendId;
    /** TigerVNC: the Unix user whose ~/.vnc/passwd will be written. */
    vncUser: string;
    isOpen: boolean;
    onClose: () => void;
}

/*
 * Sets the VNC server password. The password only lives in this component's
 * state while the modal is open; it is sent to `vncpasswd -f` on stdin and
 * cleared as soon as the request finishes. It never reaches an argv or a log.
 */
export function PasswordModal({ backend, vncUser, isOpen, onClose }: PasswordModalProps) {
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
            if (backend === "tigervnc") {
                await setTigervncUserPassword(vncUser, password);
                notify("success", "VNC password updated", `Written to ~${vncUser}/.vnc/passwd`);
            } else {
                const path = await setX11vncPassword(password);
                notify("success", "VNC password updated",
                       `Written to ${path}. Point x11vnc at it with -rfbauth ${path}.`);
            }
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
            variant={ModalVariant.small}
            title="Set VNC password"
            isOpen={isOpen}
            onClose={busy ? undefined : close}
            actions={[
                <Button key="save" variant="primary" onClick={submit}
                        isDisabled={!canSubmit} isLoading={busy}>
                    Set password
                </Button>,
                <Button key="cancel" variant="link" onClick={close} isDisabled={busy}>
                    Cancel
                </Button>,
            ]}
        >
            <Form>
                {error && <Alert variant="danger" isInline title={error} />}
                {backend === "tigervnc" && (
                    <Alert variant="info" isInline isPlain
                           title={`The password will be stored (obfuscated, mode 600) as ~${vncUser || "<user>"}/.vnc/passwd.`} />
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
        </Modal>
    );
}
