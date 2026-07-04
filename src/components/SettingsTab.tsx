import { useEffect, useState } from "react";
import {
    ActionGroup,
    Alert,
    Button,
    Card,
    CardBody,
    CardTitle,
    Form,
    FormGroup,
    FormHelperText,
    FormSelect,
    FormSelectOption,
    HelperText,
    HelperTextItem,
    TextInput,
} from "@patternfly/react-core";

import { BACKENDS, backendDef } from "../constants";
import { useNotify } from "../notifications";
import type { BackendId, RemoteConfig } from "../types";
import { toUserMessage } from "../utils/errors";
import {
    ValidationError,
    displayFromUnit,
    isLoopback,
    portForDisplay,
    portWarning,
    validateAddress,
    validateGeometry,
    validatePort,
    validateUnitName,
    validateUsername,
} from "../utils/validation";
import { PasswordModal } from "./PasswordModal";

export interface SettingsTabProps {
    config: RemoteConfig;
    save: (next: RemoteConfig) => Promise<void>;
}

interface FormState {
    backend: string;
    unit: string;
    address: string;
    port: string;
    geometry: string;
    vncUser: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

function fromConfig(config: RemoteConfig): FormState {
    return {
        backend: config.backend ?? "",
        unit: config.unit,
        address: config.address,
        port: String(config.port),
        geometry: config.geometry,
        vncUser: config.vncUser,
    };
}

function validateForm(form: FormState): { errors: Errors; config?: RemoteConfig } {
    const errors: Errors = {};
    const port = Number(form.port);

    const check = (field: keyof FormState, fn: () => void) => {
        try {
            fn();
        } catch (err) {
            errors[field] = err instanceof ValidationError ? err.message : String(err);
        }
    };

    if (form.unit)
        check("unit", () => validateUnitName(form.unit));
    else if (form.backend)
        errors.unit = "A systemd unit is required for the selected backend.";
    check("address", () => validateAddress(form.address));
    check("port", () => validatePort(port));
    if (form.geometry)
        check("geometry", () => validateGeometry(form.geometry));
    if (form.vncUser)
        check("vncUser", () => validateUsername(form.vncUser));
    if (form.backend === "tigervnc" && !form.vncUser)
        errors.vncUser = "TigerVNC needs the Unix user that owns the virtual desktop session.";

    if (Object.keys(errors).length > 0)
        return { errors };
    return {
        errors,
        config: {
            backend: (form.backend || null) as BackendId | null,
            unit: form.unit,
            address: form.address,
            port,
            geometry: form.geometry,
            vncUser: form.vncUser,
        },
    };
}

export function SettingsTab({ config, save }: SettingsTabProps) {
    const notify = useNotify();
    const [form, setForm] = useState<FormState>(() => fromConfig(config));
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);
    const [passwordOpen, setPasswordOpen] = useState(false);

    // Re-sync the form when the config changes elsewhere (backend selected on
    // the Dashboard, config loaded after mount).
    useEffect(() => {
        setForm(fromConfig(config));
        setErrors({});
    }, [config]);

    const set = (field: keyof FormState, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setErrors(prev => ({ ...prev, [field]: undefined }));
    };

    const onBackendChange = (value: string) => {
        setForm(prev => {
            if (!value)
                return { ...prev, backend: "" };
            const def = backendDef(value as BackendId);
            const unit = prev.unit || def.defaultUnit;
            const display = displayFromUnit(unit);
            return {
                ...prev,
                backend: value,
                unit,
                port: String(display !== null ? portForDisplay(display) : def.defaultPort),
            };
        });
        setErrors({});
    };

    const submit = async () => {
        const { errors: found, config: next } = validateForm(form);
        setErrors(found);
        if (!next) {
            notify("danger", "Settings not saved", "Fix the highlighted fields first.");
            return;
        }
        setSaving(true);
        try {
            await save(next);
            notify("success", "Settings saved");
        } catch (err) {
            notify("danger", "Could not save settings", toUserMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const selectedDef = form.backend ? backendDef(form.backend as BackendId) : null;
    const portNum = Number(form.port);
    const portAdvice = !errors.port && Number.isInteger(portNum) ? portWarning(portNum) : null;

    const helper = (field: keyof FormState, advice?: string | null) => {
        const message = errors[field] ?? advice;
        if (!message)
            return null;
        return (
            <FormHelperText>
                <HelperText>
                    <HelperTextItem variant={errors[field] ? "error" : "warning"}>{message}</HelperTextItem>
                </HelperText>
            </FormHelperText>
        );
    };

    return (
        <Card>
            <CardTitle>Connection settings</CardTitle>
            <CardBody>
                <Form isHorizontal maxWidth="720px">
                    <FormGroup label="VNC backend" fieldId="ctr-backend">
                        <FormSelect id="ctr-backend" value={form.backend}
                                    onChange={(_event, value) => onBackendChange(value)}
                                    aria-label="VNC backend">
                            <FormSelectOption value="" label="— none selected —" />
                            {BACKENDS.map(def => (
                                <FormSelectOption key={def.id} value={def.id}
                                                  label={def.manageable ? def.label : `${def.label} (informational only)`}
                                                  isDisabled={!def.manageable} />
                            ))}
                        </FormSelect>
                        {selectedDef && (
                            <FormHelperText>
                                <HelperText>
                                    <HelperTextItem>{selectedDef.description}</HelperTextItem>
                                </HelperText>
                            </FormHelperText>
                        )}
                    </FormGroup>

                    <FormGroup label="systemd unit" fieldId="ctr-unit">
                        <TextInput id="ctr-unit" value={form.unit}
                                   onChange={(_event, value) => set("unit", value)}
                                   validated={errors.unit ? "error" : "default"}
                                   placeholder="vncserver@:1.service"
                                   aria-label="systemd unit" />
                        {helper("unit")}
                    </FormGroup>

                    <FormGroup label="VNC address" fieldId="ctr-address">
                        <TextInput id="ctr-address" value={form.address}
                                   onChange={(_event, value) => set("address", value)}
                                   validated={errors.address ? "error" : "default"}
                                   aria-label="VNC address" />
                        {helper("address", !errors.address && !isLoopback(form.address)
                            ? "Non-loopback address: the VNC server should normally listen on 127.0.0.1 only, since Cockpit tunnels the traffic."
                            : null)}
                    </FormGroup>

                    <FormGroup label="VNC port" fieldId="ctr-port">
                        <TextInput id="ctr-port" value={form.port} type="number"
                                   onChange={(_event, value) => set("port", value)}
                                   validated={errors.port ? "error" : "default"}
                                   aria-label="VNC port" />
                        {helper("port", portAdvice)}
                    </FormGroup>

                    {form.backend === "tigervnc" && (
                        <>
                            <FormGroup label="Session user" fieldId="ctr-vnc-user">
                                <TextInput id="ctr-vnc-user" value={form.vncUser}
                                           onChange={(_event, value) => set("vncUser", value)}
                                           validated={errors.vncUser ? "error" : "default"}
                                           placeholder="username mapped in /etc/tigervnc/vncserver.users"
                                           aria-label="TigerVNC session user" />
                                {helper("vncUser")}
                            </FormGroup>
                            <FormGroup label="Desired geometry" fieldId="ctr-geometry">
                                <TextInput id="ctr-geometry" value={form.geometry}
                                           onChange={(_event, value) => set("geometry", value)}
                                           validated={errors.geometry ? "error" : "default"}
                                           placeholder="1280x800"
                                           aria-label="Desired geometry" />
                                {helper("geometry", "Applied via the user's ~/.vnc/config (geometry=…); shown here as guidance.")}
                            </FormGroup>
                        </>
                    )}

                    {selectedDef?.id === "wayvnc" && (
                        <Alert variant="info" isInline isPlain
                               title="wayvnc authentication is configured in its own config file (TLS/PAM); this plugin does not manage wayvnc passwords." />
                    )}

                    <ActionGroup>
                        <Button variant="primary" onClick={submit} isLoading={saving} isDisabled={saving}>
                            Save settings
                        </Button>
                        {selectedDef?.supportsPasswordTool && (
                            <Button variant="secondary"
                                    isDisabled={selectedDef.id === "tigervnc" && !form.vncUser}
                                    onClick={() => setPasswordOpen(true)}>
                                Set VNC password…
                            </Button>
                        )}
                    </ActionGroup>
                </Form>
                {selectedDef?.supportsPasswordTool && (
                    <PasswordModal
                        backend={selectedDef.id}
                        vncUser={form.vncUser}
                        isOpen={passwordOpen}
                        onClose={() => setPasswordOpen(false)}
                    />
                )}
            </CardBody>
        </Card>
    );
}
