import { inspect } from "node:util";

import type { CallTrace } from "./types.ts";

export type FailureTextRequest = {
    calls: CallTrace[];
    inputName: string;
    lawName: string;
    lawSnippet?: string;
    reason: string;
    sourceLocation: string;
};

function formatValue(value: unknown, prefix: string): string {
    return inspect(value, { depth: 6, sorted: true }).replaceAll("\n", `\n${prefix}`);
}

function getInputSection(inputName: string, input: unknown): string[] {
    return [`    ${inputName}: ${formatValue(input, "    ")}`];
}

function getOutputSection(call: CallTrace): string[] {
    if (call.error === undefined) {
        return ["", "  result:", `    ${formatValue(call.result, "    ")}`];
    }

    return ["", `  error: ${call.error}`];
}

function formatCall({
    call,
    inputName,
    index,
}: {
    call: CallTrace;
    inputName: string;
    index: number;
}): string {
    return [
        `  call ${index + 1}:`,
        "",
        "  input:",
        ...getInputSection(inputName, call.input),
        ...getOutputSection(call),
    ].join("\n");
}

function formatCalls(calls: CallTrace[], inputName: string): string[] {
    return calls.flatMap((call, index) => {
        const renderedCall = formatCall({ call, index, inputName });

        if (index === 0) {
            return [renderedCall];
        }

        return ["", renderedCall];
    });
}

export function renderFailureText({
    calls,
    inputName,
    lawName,
    lawSnippet,
    reason,
    sourceLocation,
}: FailureTextRequest): string {
    const lines = [
        `  ${lawName}`,
        "",
        ...formatCalls(calls, inputName),
        "",
        `  reason: ${reason}`,
        `  source: ${sourceLocation}`,
    ];

    if (lawSnippet) {
        lines.push("", `  law: ${lawSnippet}`);
    }

    return lines.join("\n");
}
