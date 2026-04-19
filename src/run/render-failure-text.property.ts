import { spec } from "property";

import { renderFailureText } from "./render-failure-text.ts";

function firstResultObject(
    input: Parameters<typeof renderFailureText>[0],
): Record<string, unknown> | undefined {
    const value = input.calls.find((call) => call.error === undefined)?.result;

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    return undefined;
}

function nestedResultKey(input: Parameters<typeof renderFailureText>[0]): string | undefined {
    const objectValue = firstResultObject(input);

    if (!objectValue) {
        return undefined;
    }

    for (const value of Object.values(objectValue)) {
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            return Object.keys(value)[0];
        }
    }

    return undefined;
}

function nonEmptyNestedResultKey(
    input: Parameters<typeof renderFailureText>[0],
): string | undefined {
    const key = nestedResultKey(input);

    if (key && key.length > 0) {
        return key;
    }

    return undefined;
}

function isUnquotedIdentifierKey(key: string): boolean {
    return /^[A-Za-z_$][\w$]*$/.test(key);
}

function disjointKeys(keys: string[]): string[] {
    return keys.filter((key) => !keys.some((other) => other !== key && other.includes(key)));
}

function renderedResultKeys(input: Parameters<typeof renderFailureText>[0]): string[] {
    const objectValue = firstResultObject(input);

    if (!objectValue) {
        return [];
    }

    return disjointKeys(Object.keys(objectValue).filter(isUnquotedIdentifierKey));
}

function unsortedRenderedResultKeys(input: Parameters<typeof renderFailureText>[0]): string[] {
    const keys = renderedResultKeys(input);
    const sorted = [...keys].toSorted();

    if (keys.join("|") === sorted.join("|")) {
        return [];
    }

    return sorted;
}

function firstResultSection(text: string): string {
    const [, afterResult = ""] = text.split("  result:\n");
    const [section = ""] = afterResult.split("\n\n  ");
    return section;
}

function keysAppearInOrder(renderedResultSection: string, keys: string[]): boolean {
    let previousIndex = -1;

    for (const key of keys) {
        const nextIndex = Math.max(
            renderedResultSection.indexOf(`${key}:`),
            renderedResultSection.indexOf(`'${key}':`),
        );

        if (nextIndex <= previousIndex) {
            return false;
        }

        previousIndex = nextIndex;
    }

    return true;
}

export const renderFailureTextSpec = spec(renderFailureText, ({ property }) => {
    property("includes the property name reason and source", {
        holds: ({ input, result }) =>
            result.includes(`  ${input.propertyName}`) &&
            result.includes(`  reason: ${input.reason}`) &&
            result.includes(`  source: ${input.sourceLocation}`),
    });

    property("numbers calls starting at one", {
        where: ({ input }) => input.calls.length > 1,
        holds: ({ result }) => result.includes("  call 1:") && result.includes("  call 2:"),
    });

    property("starts the first call immediately after the header gap", {
        where: ({ input }) => input.calls.length > 0,
        holds: ({ input, result }) => result.startsWith(`  ${input.propertyName}\n\n  call 1:`),
    });

    property("separates later calls with a blank line", {
        where: ({ input }) => input.calls.length > 1,
        holds: ({ result }) => result.includes("\n\n  call 2:"),
    });

    property("renders result calls separately from error calls", {
        where: ({ input }) =>
            input.calls.some((call) => call.error === undefined) &&
            input.calls.some((call) => call.error !== undefined),
        holds: ({ input, result }) =>
            result.includes("  result:") &&
            input.calls
                .filter((call) => call.error !== undefined)
                .every((call) => result.includes(`  error: ${call.error}`)),
    });

    property("renders object result keys when present", {
        where: ({ input }) => renderedResultKeys(input).length > 0,
        holds: ({ input, result }) => {
            const renderedResultSection = firstResultSection(result);

            return renderedResultKeys(input).every((key) => renderedResultSection.includes(key));
        },
    });

    property("sorts object result keys before rendering", {
        where: ({ input }) => unsortedRenderedResultKeys(input).length > 1,
        holds: ({ input, result }) =>
            keysAppearInOrder(firstResultSection(result), unsortedRenderedResultKeys(input)),
    });

    property("renders nested result values beyond the first level", {
        where: ({ input }) => nonEmptyNestedResultKey(input) !== undefined,
        holds: ({ input, result }) =>
            firstResultSection(result).includes(nonEmptyNestedResultKey(input) ?? ""),
    });

    property("includes the property snippet when present", {
        where: ({ input }) => Boolean(input.propertySnippet),
        holds: ({ input, result }) => result.includes(`  property: ${input.propertySnippet}`),
    });
});
