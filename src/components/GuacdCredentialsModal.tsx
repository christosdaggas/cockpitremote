import { useState, type FormEvent } from "react";
import {
    Button,
    Form,
    FormGroup,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    TextInput,
} from "@patternfly/react-core";

import type { GuacdCredentials } from "../services/guacdTunnel";

export interface GuacdCredentialsModalProps {
    protocol: "rdp" | "vnc";
    isOpen: boolean;
    onSubmit: (credentials: GuacdCredentials) => void;
    onCancel: () => void;
}

export function GuacdCredentialsModal({ protocol, isOpen, onSubmit, onCancel }: GuacdCredentialsModalProps) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [domain, setDomain] = useState("");

    const reset = () => {
        setUsername("");
        setPassword("");
        setDomain("");
    };

    const submit = (event?: FormEvent) => {
        event?.preventDefault();
        const credentials = { username: protocol === "vnc" ? "" : username, password, domain: protocol === "vnc" ? "" : domain };
        reset();
        onSubmit(credentials);
    };

    const cancel = () => {
        reset();
        onCancel();
    };

    const label = protocol.toUpperCase();
    const usernameRequired = protocol === "rdp";

    return (
        <Modal
            className="ctr-password-modal"
            width="35rem"
            maxWidth="calc(100vw - 2rem)"
            aria-labelledby="ctr-guacd-credentials-modal-title"
            isOpen={isOpen}
            onClose={cancel}
        >
            <ModalHeader title={`${label} authentication required`} labelId="ctr-guacd-credentials-modal-title" />
            <ModalBody>
                <Form onSubmit={submit}>
                    {protocol === "rdp" && (
                        <FormGroup label="RDP username" fieldId="guacd-username" isRequired>
                            <TextInput
                                id="guacd-username"
                                value={username}
                                onChange={(_event, value) => setUsername(value)}
                                autoComplete="off"
                                aria-label="RDP username"
                            />
                        </FormGroup>
                    )}
                    <FormGroup label={`${label} password`} fieldId="guacd-password" isRequired>
                        <TextInput
                            id="guacd-password"
                            type="password"
                            value={password}
                            onChange={(_event, value) => setPassword(value)}
                            autoComplete="off"
                            aria-label={`${label} password`}
                        />
                    </FormGroup>
                    {protocol === "rdp" && (
                        <FormGroup label="Domain" fieldId="guacd-domain">
                            <TextInput
                                id="guacd-domain"
                                value={domain}
                                onChange={(_event, value) => setDomain(value)}
                                autoComplete="off"
                                aria-label="RDP domain"
                            />
                        </FormGroup>
                    )}
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" onClick={() => submit()}
                        isDisabled={(usernameRequired && username.trim().length === 0) || password.length === 0}>
                    Connect
                </Button>
                <Button variant="link" onClick={cancel}>Cancel</Button>
            </ModalFooter>
        </Modal>
    );
}
