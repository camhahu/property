import { spec } from "holds";

import { renderPropertyReport } from "./render-property-report.ts";

function displayedSpecPath(input: Parameters<typeof renderPropertyReport>[0]): string | undefined {
    const path = input.specFilePath.split("/").at(-1) ?? input.specFilePath;

    if (path.length > 0 && path !== ".") {
        return path;
    }

    return undefined;
}

function matchesDisplayedSpecPath(
    input: Parameters<typeof renderPropertyReport>[0],
    result: string,
): boolean {
    const path = displayedSpecPath(input);
    return path === undefined || result.includes(path);
}

export const propertyReportSpec = spec(renderPropertyReport, ({ law, section }) => {
    section("summary", () => {
        law("includes the relative spec path target name and law count", {
            holds: ({ input, result }) =>
                result.includes(input.targetName) &&
                result.includes(`${input.result.lawResults.length} laws`) &&
                matchesDisplayedSpecPath(input, result),
        });

        law("renders passing law lines with input counts", {
            where: ({ input }) => input.result.lawResults.some((lawResult) => lawResult.passed),
            holds: ({ input, result }) =>
                input.result.lawResults
                    .filter((lawResult) => lawResult.passed)
                    .every((lawResult) =>
                        result.includes(`    ✓ ${lawResult.lawName}    ${lawResult.runs} inputs`),
                    ),
        });

        law("renders failing law lines with the failure count", {
            where: ({ input }) => input.result.lawResults.some((lawResult) => !lawResult.passed),
            holds: ({ input, result }) =>
                input.result.lawResults
                    .filter((lawResult) => !lawResult.passed)
                    .every((lawResult) =>
                        result.includes(
                            `    ✗ ${lawResult.lawName}    failed after ${lawResult.runs} inputs`,
                        ),
                    ),
        });

        law("omits the failure section when there is no failing example", {
            where: ({ input }) => input.result.firstFailure?.failure === undefined,
            holds: ({ result }) => !result.includes("  Failure"),
        });

        law("includes the failure section when a failing example exists", {
            where: ({ input }) => input.result.firstFailure?.failure !== undefined,
            holds: ({ input, result }) =>
                result.includes("  Failure") &&
                result.includes(`  ${input.result.firstFailure?.lawName}`),
        });
    });
});
