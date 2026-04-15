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

function getCallLabel(call: CallTrace, index: number): string {
    return call.kind === "generated"
        ? `  call ${index + 1} (generated):`
        : `  call ${index + 1} (run):`;
}

function formatValue(value: unknown, prefix: string): string {
    return inspect(value, { depth: 6, sorted: true }).replaceAll("\n", `\n${prefix}`);
}

function getInputsSection(analyzedSpec: AnalyzedSpec, inputs: unknown[]): string[] {
    return analyzedSpec.parameterShapes.map(
        (parameter, index) => `    ${parameter.name}: ${formatValue(inputs[index], "    ")}`,
    );
}

function getOutputSection(call: CallTrace): string[] {
    if (call.error !== undefined) {
        return ["", `  error: ${call.error}`];
    }

    return ["", "  result:", `    ${formatValue(call.result, "    ")}`];
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
        getCallLabel(call, index),
        "",
        "  inputs:",
        ...getInputsSection(analyzedSpec, call.inputs),
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
