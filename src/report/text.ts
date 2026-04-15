import path from "node:path";

import type { AnalyzedSpec } from "../load/analyze-spec-file.ts";
import type { MutationResult } from "../mutate/run-mutants.ts";
import { formatFailure } from "../run/format-failure.ts";
import type { PropertySuiteResult } from "../run/properties.ts";

type PropertyReportRequest = {
    analyzedSpec: AnalyzedSpec;
    result: PropertySuiteResult;
};

function getPropertyLines(result: PropertySuiteResult): string[] {
    return result.lawResults.map((lawResult) =>
        lawResult.passed
            ? `    ✓ ${lawResult.lawName}    ${lawResult.runs} inputs`
            : `    ✗ ${lawResult.lawName}    failed after ${lawResult.runs} inputs`,
    );
}

function getFailureLines({ analyzedSpec, result }: PropertyReportRequest): string[] {
    return result.firstFailure?.failure
        ? [
              "",
              "  Failure",
              "",
              formatFailure({
                  analyzedSpec,
                  failure: result.firstFailure.failure,
                  lawName: result.firstFailure.lawName,
              }),
          ]
        : [];
}

export function renderPropertyReport({ analyzedSpec, result }: PropertyReportRequest): string {
    return [
        path.relative(process.cwd(), analyzedSpec.specFilePath),
        `  ${analyzedSpec.targetName}    ${result.lawResults.length} laws`,
        "",
        ...getPropertyLines(result),
        ...getFailureLines({ analyzedSpec, result }),
    ].join("\n");
}

export function renderMutationReport(results: MutationResult[]): string {
    const killed = results.filter((result) => result.killed);
    const survived = results.filter((result) => !result.killed);
    const confidence =
        results.length === 0 ? 100 : Math.round((killed.length / results.length) * 100);
    const lines = ["", "  Mutations", `    killed ${killed.length}/${results.length}`];

    if (survived.length > 0) {
        lines.push("", "  Weak laws");
        lines.push(
            ...survived.flatMap((mutant) => [
                `    ${mutant.id}: ${mutant.description}`,
                "    survived all laws",
            ]),
        );
    }

    lines.push("", `  confidence: ${confidence}%`);
    return lines.join("\n");
}
