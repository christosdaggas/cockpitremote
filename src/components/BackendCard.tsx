import {
    Button,
    Card,
    CardBody,
    CardFooter,
    CardHeader,
    CardTitle,
    DescriptionList,
    DescriptionListDescription,
    DescriptionListGroup,
    DescriptionListTerm,
    Label,
    LabelGroup,
} from "@patternfly/react-core";

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
    const installed = backend.binaryPath !== null;
    const unit = (isSelected && activeUnit) || backend.detectedUnit;

    return (
        <Card isSelected={isSelected}>
            <CardHeader>
                <CardTitle>{backend.label}</CardTitle>
            </CardHeader>
            <CardBody>
                <LabelGroup>
                    {installed
                        ? <Label color="blue">installed{backend.version ? ` ${backend.version}` : ""}</Label>
                        : <Label color="grey">not installed</Label>}
                    {installed && <ActiveLabel status={backend.status} />}
                    {installed && <EnabledLabel status={backend.status} />}
                    {isSelected && <Label color="purple">selected</Label>}
                </LabelGroup>
                <DescriptionList isCompact isHorizontal className="pf-v5-u-mt-md">
                    {backend.binaryPath && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>Binary</DescriptionListTerm>
                            <DescriptionListDescription>{backend.binaryPath}</DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                    {unit && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>Unit</DescriptionListTerm>
                            <DescriptionListDescription>{unit}</DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                </DescriptionList>
                {backend.notes.length > 0 && (
                    <ul className="ctr-note-list">
                        {backend.notes.map((note, i) => <li key={i}>{note}</li>)}
                    </ul>
                )}
            </CardBody>
            <CardFooter>
                {installed && unit && backend.supported && (
                    <div className="pf-v5-u-mb-sm">
                        <ServiceActions unit={unit} status={backend.status} onRefresh={onRefresh} />
                    </div>
                )}
                {installed && backend.supported && !isSelected && (
                    <Button variant="tertiary" size="sm" onClick={() => onSelect(backend)}>
                        Use this backend
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}
