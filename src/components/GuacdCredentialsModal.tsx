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

import { _, format } from "../i18n";
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
            <ModalHeader title={format(_("$0 authentication required"), label)} labelId="ctr-guacd-credentials-modal-title" />
            <ModalBody>
                <Form onSubmit={submit}>
                    {protocol === "rdp" && (
                        <FormGroup label={_("RDP username")} fieldId="guacd-username" isRequired>
                            <TextInput
                                id="guacd-username"
                                value={username}
                                onChange={(_event, value) => setUsername(value)}
                                autoComplete="off"
                                aria-label={_("RDP username")}
                            />
                        </FormGroup>
                    )}
                    <FormGroup label={format(_("$0 password"), label)} fieldId="guacd-password" isRequired>
                        <TextInput
                            id="guacd-password"
                            type="password"
                            value={password}
                            onChange={(_event, value) => setPassword(value)}
                            autoComplete="off"
                            aria-label={format(_("$0 password"), label)}
                        />
                    </FormGroup>
                    {protocol === "rdp" && (
                        <FormGroup label={_("Domain")} fieldId="guacd-domain">
                            <TextInput
                                id="guacd-domain"
                                value={domain}
                                onChange={(_event, value) => setDomain(value)}
                                autoComplete="off"
                                aria-label={_("RDP domain")}
                            />
                        </FormGroup>
                    )}
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" onClick={() => submit()}
                        isDisabled={(usernameRequired && username.trim().length === 0) || password.length === 0}>
                    {_("Connect")}
                </Button>
                <Button variant="link" onClick={cancel}>{_("Cancel")}</Button>
            </ModalFooter>
        </Modal>
    );
}
