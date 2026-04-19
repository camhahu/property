import path from "node:path";

import type { PropertySource } from "../load/analyze-spec-file.ts";
import { formatFailure } from "../run/format-failure.ts";
import type { PropertySuiteResult } from "../run/properties.ts";

type PropertyReportRequest = {
    inputName: string;
    propertySources: Record<string, PropertySource>;
    result: PropertySuiteResult;
    specFilePath: string;
    targetName: string;
};

function getPropertyLines(result: PropertySuiteResult): string[] {
    return result.propertyResults.map((propertyResult) => {
        if (propertyResult.passed) {
            return `    ✓ ${propertyResult.propertyName}    ${propertyResult.runs} inputs`;
        }

        return `    ✗ ${propertyResult.propertyName}    failed after ${propertyResult.runs} inputs`;
    });
}

function getFailureLines({ inputName, propertySources, result }: PropertyReportRequest): string[] {
    if (!result.firstFailure?.failure) {
        return [];
    }

    return [
        "",
        "  Failure",
        "",
        formatFailure({
            failure: result.firstFailure.failure,
            inputName,
            propertyName: result.firstFailure.propertyName,
            propertySources,
        }),
    ];
}

export function renderPropertyReport({
    inputName,
    propertySources,
    result,
    specFilePath,
    targetName,
}: PropertyReportRequest): string {
    return [
        path.relative(process.cwd(), specFilePath),
        `  ${targetName}    ${result.propertyResults.length} properties`,
        "",
        ...getPropertyLines(result),
        ...getFailureLines({ inputName, propertySources, result, specFilePath, targetName }),
    ].join("\n");
}
