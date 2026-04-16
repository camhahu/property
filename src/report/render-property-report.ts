import path from "node:path";

import type { LawSource } from "../load/analyze-spec-file.ts";
import { formatFailure } from "../run/format-failure.ts";
import type { PropertySuiteResult } from "../run/properties.ts";

type PropertyReportRequest = {
    inputName: string;
    lawSources: Record<string, LawSource>;
    result: PropertySuiteResult;
    specFilePath: string;
    targetName: string;
};

function getPropertyLines(result: PropertySuiteResult): string[] {
    return result.lawResults.map((lawResult) => {
        if (lawResult.passed) {
            return `    ✓ ${lawResult.lawName}    ${lawResult.runs} inputs`;
        }

        return `    ✗ ${lawResult.lawName}    failed after ${lawResult.runs} inputs`;
    });
}

function getFailureLines({ inputName, lawSources, result }: PropertyReportRequest): string[] {
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
            lawName: result.firstFailure.lawName,
            lawSources,
        }),
    ];
}

export function renderPropertyReport({
    inputName,
    lawSources,
    result,
    specFilePath,
    targetName,
}: PropertyReportRequest): string {
    return [
        path.relative(process.cwd(), specFilePath),
        `  ${targetName}    ${result.lawResults.length} laws`,
        "",
        ...getPropertyLines(result),
        ...getFailureLines({ inputName, lawSources, result, specFilePath, targetName }),
    ].join("\n");
}
