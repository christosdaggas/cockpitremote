import {
    Button,
    DescriptionList,
    DescriptionListDescription,
    DescriptionListGroup,
    DescriptionListTerm,
    Label,
} from "@patternfly/react-core";

import { backendDef } from "../constants";
import type { BackendInfo } from "../types";
import { ActiveLabel, EnabledLabel } from "./common/StatusLabel";
import { ServiceActions } from "./ServiceActions";

export interface BackendCardProps {
    backend: BackendInfo;
    isSelected: boolean;
    /** Unit the plugin is configured to manage when this backend is selected. */
    activeUnit: string | null;
    onSelect: (backend: BackendInfo) => Promise<void>;
    onRefresh: () => Promise<void>;
}

export function BackendCard({ backend, isSelected, activeUnit, onSelect, onRefresh }: BackendCardProps) {
    const def = backendDef(backend.id);
    const installed = backend.binaryPath !== null;
    const unit = (isSelected && activeUnit) || backend.detectedUnit;
    const port = backend.detectedPort ?? backend.defaultPort;

    return (
        <section className={`ctr-backend-card${isSelected ? " ctr-backend-card-selected" : ""}`}>
            <div className="ctr-backend-card-body">
                <div className="ctr-backend-card-heading">
                    <div>
                        <h3 className="ctr-backend-card-title">{backend.label}</h3>
                        <p className="ctr-backend-card-summary">{def.description}</p>
                    </div>
                    {isSelected && <Label color="purple">Selected</Label>}
                </div>

                <div className="ctr-backend-labels">
                    <Label color={backend.protocol === "rdp" ? "orange" : "cyan"}>{backend.protocol.toUpperCase()}</Label>
                    {installed
                        ? <Label color="blue">installed{backend.version ? ` ${backend.version}` : ""}</Label>
                        : <Label color="grey">not installed</Label>}
                    {installed && <ActiveLabel status={backend.status} />}
                    {installed && <EnabledLabel status={backend.status} />}
                    {!backend.supported && <Label color="gold">not supported</Label>}
                </div>

                <DescriptionList isCompact isHorizontal className="ctr-backend-details">
                    <DescriptionListGroup>
                        <DescriptionListTerm>Binary</DescriptionListTerm>
                        <DescriptionListDescription id={`${backend.id}-binary`}>
                            {backend.binaryPath ?? "Not found"}
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    {unit && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>Unit</DescriptionListTerm>
                            <DescriptionListDescription id={`${backend.id}-unit`}>
                                {unit}{backend.unitScope === "user" ? " (user service)" : ""}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                    {installed && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>Port</DescriptionListTerm>
                            <DescriptionListDescription id={`${backend.id}-port`}>
                                {port}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                </DescriptionList>

                {backend.notes.length > 0 && (
                    <div className="ctr-backend-notes">
                        {backend.notes.map((note, i) => <p key={i}>{note}</p>)}
                    </div>
                )}
            </div>

            <div className="ctr-backend-card-footer">
                {installed && unit && backend.supported && isSelected && (
                    <ServiceActions unit={unit} scope={backend.unitScope}
                                    status={backend.status} onRefresh={onRefresh} />
                )}
                {installed && backend.supported && !isSelected && (
                    <Button variant="secondary" size="sm" onClick={() => onSelect(backend)}>
                        Use this backend
                    </Button>
                )}
                {!installed && <span className="ctr-backend-card-hint">Install this backend on the host.</span>}
            </div>
        </section>
    );
}
