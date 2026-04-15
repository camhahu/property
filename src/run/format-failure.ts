import { inspect } from "node:util";

import type { AnalyzedSpec } from "../load/analyze-spec-file.ts";
import type { CallTrace, FailureDetails } from "./types.ts";

type FailureFormatRequest = {
    analyzedSpec: AnalyzedSpec;
    failure: FailureDetails;
    lawName: string;
};

function getLawSection(
    analyzedSpec: AnalyzedSpec,
    lawName: string,
): { location: string; snippet?: string } {
    const lawSource = analyzedSpec.lawSources[lawName];

    return {
        location: lawSource?.location ?? "unknown",
        snippet: lawSource?.snippet,
    };
}

function formatValue(value: unknown, prefix: string): string {
    return inspect(value, { depth: 6, sorted: true }).replaceAll("\n", `\n${prefix}`);
}

function getInputSection(analyzedSpec: AnalyzedSpec, input: unknown): string[] {
    return [`    ${analyzedSpec.inputName}: ${formatValue(input, "    ")}`];
}

function getOutputSection(call: CallTrace): string[] {
    if (call.error === undefined) {
        return ["", "  result:", `    ${formatValue(call.result, "    ")}`];
    }

    return ["", `  error: ${call.error}`];
}

function formatCall({
    analyzedSpec,
    call,
    index,
}: {
    analyzedSpec: AnalyzedSpec;
    call: CallTrace;
    index: number;
}): string {
    return [
        `  call ${index + 1}:`,
        "",
        "  input:",
        ...getInputSection(analyzedSpec, call.input),
        ...getOutputSection(call),
    ].join("\n");
}

function formatCalls(analyzedSpec: AnalyzedSpec, failure: FailureDetails): string[] {
    return failure.calls.flatMap((call, index) => {
        const renderedCall = formatCall({ analyzedSpec, call, index });
        return index === 0 ? [renderedCall] : ["", renderedCall];
    });
}

export function formatFailure({ analyzedSpec, failure, lawName }: FailureFormatRequest): string {
    const lawSection = getLawSection(analyzedSpec, lawName);
    const lines = [
        `  ${lawName}`,
        "",
        ...formatCalls(analyzedSpec, failure),
        "",
        `  reason: ${failure.reason}`,
        `  source: ${lawSection.location}`,
    ];

    if (lawSection.snippet) {
        lines.push("", `  law: ${lawSection.snippet}`);
    }

    return lines.join("\n");
}
