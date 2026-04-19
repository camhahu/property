import { spec } from "property";

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

export const propertyReportSpec = spec(renderPropertyReport, ({ property }) => {
    property("includes the relative spec path target name and property count", {
        holds: ({ input, result }) =>
            result.includes(input.targetName) &&
            result.includes(`${input.result.propertyResults.length} properties`) &&
            matchesDisplayedSpecPath(input, result),
    });

    property("renders passing property lines with input counts", {
        where: ({ input }) =>
            input.result.propertyResults.some((propertyResult) => propertyResult.passed),
        holds: ({ input, result }) =>
            input.result.propertyResults
                .filter((propertyResult) => propertyResult.passed)
                .every((propertyResult) =>
                    result.includes(
                        `    ✓ ${propertyResult.propertyName}    ${propertyResult.runs} inputs`,
                    ),
                ),
    });

    property("renders failing property lines with the failure count", {
        where: ({ input }) =>
            input.result.propertyResults.some((propertyResult) => !propertyResult.passed),
        holds: ({ input, result }) =>
            input.result.propertyResults
                .filter((propertyResult) => !propertyResult.passed)
                .every((propertyResult) =>
                    result.includes(
                        `    ✗ ${propertyResult.propertyName}    failed after ${propertyResult.runs} inputs`,
                    ),
                ),
    });

    property("omits the failure section when there is no failing example", {
        where: ({ input }) => input.result.firstFailure?.failure === undefined,
        holds: ({ result }) => !result.includes("  Failure"),
    });

    property("includes the failure section when a failing example exists", {
        where: ({ input }) => input.result.firstFailure?.failure !== undefined,
        holds: ({ input, result }) =>
            result.includes("  Failure") &&
            result.includes(`  ${input.result.firstFailure?.propertyName}`),
    });
});
