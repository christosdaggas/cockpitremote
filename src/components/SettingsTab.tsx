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

import { BACKENDS, DEFAULT_RDP_PORT, backendDef } from "../constants";
import { useNotify } from "../notifications";
import type { BackendId, BackendInfo, RemoteConfig } from "../types";
import { toUserMessage } from "../utils/errors";
import {
    ValidationError,
    isLoopback,
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
    onRefresh: () => Promise<void>;
    /** Detection results, used to gate and pre-fill backend choices. */
    backends: BackendInfo[] | null;
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

export function SettingsTab({ config, save, onRefresh, backends }: SettingsTabProps) {
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
            const info = backends?.find(b => b.id === value);
            // A unit is kept only when it belongs to the selected backend —
            // carrying another backend's unit across yields a broken mix
            // (wrong systemd scope, wrong service).
            const unit = prev.unit && prev.unit.startsWith(def.unitPrefix)
                ? prev.unit
                : (info?.detectedUnit ?? def.defaultUnit);
            return {
                ...prev,
                backend: value,
                unit,
                port: String(info?.detectedPort ?? def.defaultPort),
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
    const canManagePassword = selectedDef?.supportsPasswordTool === true;
    const portNum = Number(form.port);
    const portAdvice = !errors.port && Number.isInteger(portNum)
        ? (selectedDef?.protocol === "rdp" && portNum !== DEFAULT_RDP_PORT
            ? `RDP conventionally listens on port ${DEFAULT_RDP_PORT}. Double-check this value.`
            : portWarning(portNum))
        : null;
    const unitAdvice = !errors.unit && selectedDef && form.unit && !form.unit.startsWith(selectedDef.unitPrefix)
        ? `This does not look like a ${selectedDef.label} unit — its default is "${selectedDef.defaultUnit}".`
        : null;

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
                    <FormGroup label="Remote desktop backend" fieldId="ctr-backend">
                        <FormSelect id="ctr-backend" value={form.backend}
                                    onChange={(_event, value) => onBackendChange(value)}
                                    aria-label="Remote desktop backend">
                            <FormSelectOption value="" label="— none selected —" />
                            {BACKENDS.map(def => {
                                const info = backends?.find(b => b.id === def.id);
                                const unusable = !def.manageable || info?.supported === false;
                                return (
                                    <FormSelectOption key={def.id} value={def.id}
                                                      label={unusable ? `${def.label} (not usable on this host)` : def.label}
                                                      isDisabled={unusable} />
                                );
                            })}
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
                                    placeholder="gnome-remote-desktop.service"
                                    aria-label="systemd unit" />
                        {helper("unit", unitAdvice)}
                    </FormGroup>

                    <FormGroup label="Target address" fieldId="ctr-address">
                        <TextInput id="ctr-address" value={form.address}
                                   onChange={(_event, value) => set("address", value)}
                                   validated={errors.address ? "error" : "default"}
                                   aria-label="Target address" />
                        {helper("address", !errors.address && !isLoopback(form.address)
                            ? "Non-loopback address: the VNC server should normally listen on 127.0.0.1 only, since Cockpit tunnels the traffic."
                            : null)}
                    </FormGroup>

                    <FormGroup label="Target port" fieldId="ctr-port">
                        <TextInput id="ctr-port" value={form.port} type="number"
                                   onChange={(_event, value) => set("port", value)}
                                   validated={errors.port ? "error" : "default"}
                                   aria-label="Target port" />
                        {helper("port", portAdvice)}
                    </FormGroup>

                    {selectedDef?.id === "grd" && (
                        <Alert variant="info" isInline isPlain
                               title="GNOME VNC runs per user. Use password authentication for unattended Cockpit connections; prompt mode requires approval on the host desktop." />
                    )}

                    {selectedDef?.id === "grd-rdp" && (
                        <Alert variant="info" isInline isPlain
                               title="GNOME RDP uses guacd for the browser console. Install and start guacd on this host if the Dashboard reports the gateway is missing." />
                    )}

                    <ActionGroup>
                        <Button variant="primary" onClick={submit} isLoading={saving} isDisabled={saving}>
                            Save settings
                        </Button>
                        {canManagePassword && (
                            <Button variant="secondary"
                                     onClick={() => setPasswordOpen(true)}>
                                Set VNC password…
                            </Button>
                        )}
                    </ActionGroup>
                </Form>
                {canManagePassword && (
                    <PasswordModal
                        backend={selectedDef.id}
                        isOpen={passwordOpen}
                        onClose={() => setPasswordOpen(false)}
                        onUpdated={onRefresh}
                    />
                )}
            </CardBody>
        </Card>
    );
}
