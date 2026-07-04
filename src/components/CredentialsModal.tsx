import { useState, type FormEvent } from "react";
import {
    Alert,
    Button,
    Form,
    FormGroup,
    Modal,
    ModalVariant,
    TextInput,
} from "@patternfly/react-core";

export interface CredentialsModalProps {
    isOpen: boolean;
    message: string | null;
    onSubmit: (password: string) => void;
    onCancel: () => void;
}

/*
 * Prompts for the VNC password when the server requests authentication.
 * The password is handed straight to RFB.sendCredentials() and local state is
 * cleared immediately — it is never persisted or logged.
 */
export function CredentialsModal({ isOpen, message, onSubmit, onCancel }: CredentialsModalProps) {
    const [password, setPassword] = useState("");

    const submit = (event?: FormEvent) => {
        event?.preventDefault();
        const value = password;
        setPassword("");
        onSubmit(value);
    };

    const cancel = () => {
        setPassword("");
        onCancel();
    };

    return (
        <Modal
            variant={ModalVariant.small}
            title="VNC authentication required"
            isOpen={isOpen}
            onClose={cancel}
            actions={[
                <Button key="connect" variant="primary" onClick={() => submit()}
                        isDisabled={password.length === 0}>
                    Connect
                </Button>,
                <Button key="cancel" variant="link" onClick={cancel}>Cancel</Button>,
            ]}
        >
            <Form onSubmit={submit}>
                {message && <Alert variant="danger" isInline isPlain title={message} />}
                <FormGroup label="VNC password" fieldId="vnc-password" isRequired>
                    <TextInput
                        id="vnc-password"
                        type="password"
                        value={password}
                        onChange={(_event, value) => setPassword(value)}
                        autoComplete="off"
                        aria-label="VNC password"
                    />
                </FormGroup>
            </Form>
        </Modal>
    );
}
