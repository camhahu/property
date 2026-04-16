import { spec } from "holds";

import { formatFailure } from "./format-failure.ts";

function hasLawSource(input: Parameters<typeof formatFailure>[0]): boolean {
    return Object.hasOwn(input.lawSources, input.lawName);
}

export const formatFailureSpec = spec(formatFailure, ({ law, section }) => {
    section("output", () => {
        law("includes the law name and reason", {
            holds: ({ input, result }) =>
                result.includes(`  ${input.lawName}`) &&
                result.includes(`  reason: ${input.failure.reason}`),
        });

        law("renders each call with the analyzed input name", {
            where: ({ input }) => input.failure.calls.length > 0 && input.inputName.length > 0,
            holds: ({ input, result }) =>
                result.includes("  call 1:") && result.includes(`    ${input.inputName}:`),
        });

        law("uses an unknown source when the law is missing", {
            where: ({ input }) => !hasLawSource(input),
            holds: ({ result }) => result.includes("  source: unknown"),
        });

        law("uses the recorded source location when the law is known", {
            where: ({ input }) => hasLawSource(input),
            holds: ({ input, result }) =>
                result.includes(`  source: ${input.lawSources[input.lawName]?.location}`),
        });

        law("includes the recorded law snippet when present", {
            where: ({ input }) => Boolean(input.lawSources[input.lawName]?.snippet),
            holds: ({ input, result }) =>
                result.includes(`  law: ${input.lawSources[input.lawName]?.snippet}`),
        });
    });
});
