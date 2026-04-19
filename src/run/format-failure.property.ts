import { spec } from "property";

import { formatFailure } from "./format-failure.ts";

function hasPropertySource(input: Parameters<typeof formatFailure>[0]): boolean {
    return Object.hasOwn(input.propertySources, input.propertyName);
}

export const formatFailureSpec = spec(formatFailure, ({ property }) => {
    property("includes the property name and reason", {
        holds: ({ input, result }) =>
            result.includes(`  ${input.propertyName}`) &&
            result.includes(`  reason: ${input.failure.reason}`),
    });

    property("renders each call with the analyzed input name", {
        where: ({ input }) => input.failure.calls.length > 0 && input.inputName.length > 0,
        holds: ({ input, result }) =>
            result.includes("  call 1:") && result.includes(`    ${input.inputName}:`),
    });

    property("uses an unknown source when the property is missing", {
        where: ({ input }) => !hasPropertySource(input),
        holds: ({ result }) => result.includes("  source: unknown"),
    });

    property("uses the recorded source location when the property is known", {
        where: ({ input }) => hasPropertySource(input),
        holds: ({ input, result }) =>
            result.includes(`  source: ${input.propertySources[input.propertyName]?.location}`),
    });

    property("includes the recorded property snippet when present", {
        where: ({ input }) => Boolean(input.propertySources[input.propertyName]?.snippet),
        holds: ({ input, result }) =>
            result.includes(`  property: ${input.propertySources[input.propertyName]?.snippet}`),
    });
});
