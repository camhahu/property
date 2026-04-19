import { spec } from "property";

import { renderMutationReport } from "./render-mutation-report.ts";

function killedCount(results: Parameters<typeof renderMutationReport>[0]): number {
    return results.filter((result) => result.killed).length;
}

function survived(results: Parameters<typeof renderMutationReport>[0]) {
    return results.filter((result) => !result.killed);
}

function expectedConfidence(results: Parameters<typeof renderMutationReport>[0]): number {
    if (results.length === 0) {
        return 100;
    }

    return Math.round((killedCount(results) / results.length) * 100);
}

export const mutationReportSpec = spec(renderMutationReport, ({ property }) => {
    property("reports unavailable confidence when no candidates are supported", {
        where: ({ input }) => input.length === 0,
        holds: ({ result }) =>
            result.includes("    no supported mutation candidates") &&
            result.includes("  confidence: unavailable"),
    });

    property("reports killed mutants and confidence consistently", {
        where: ({ input }) => input.length > 0,
        holds: ({ input, result }) =>
            result.includes(`    killed ${killedCount(input)}/${input.length}`) &&
            result.includes(`  confidence: ${expectedConfidence(input)}%`),
    });

    property("omits the weak properties section when nothing survives", {
        where: ({ input }) => survived(input).length === 0,
        holds: ({ result }) => !result.includes("  Weak properties"),
    });

    property("includes each surviving mutant by id and description", {
        where: ({ input }) => survived(input).length > 0,
        holds: ({ input, result }) =>
            survived(input).every(
                (mutant) =>
                    result.includes(`    ${mutant.id}: ${mutant.description}`) &&
                    result.includes("    survived all properties"),
            ),
    });
});
