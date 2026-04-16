import { spec } from "holds";

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

export const mutationReportSpec = spec(renderMutationReport, ({ law, section }) => {
    section("summary", () => {
        law("reports unavailable confidence when no candidates are supported", {
            where: ({ input }) => input.length === 0,
            holds: ({ result }) =>
                result.includes("    no supported mutation candidates") &&
                result.includes("  confidence: unavailable"),
        });

        law("reports killed mutants and confidence consistently", {
            where: ({ input }) => input.length > 0,
            holds: ({ input, result }) =>
                result.includes(`    killed ${killedCount(input)}/${input.length}`) &&
                result.includes(`  confidence: ${expectedConfidence(input)}%`),
        });

        law("omits the weak laws section when nothing survives", {
            where: ({ input }) => survived(input).length === 0,
            holds: ({ result }) => !result.includes("  Weak laws"),
        });

        law("includes each surviving mutant by id and description", {
            where: ({ input }) => survived(input).length > 0,
            holds: ({ input, result }) =>
                survived(input).every(
                    (mutant) =>
                        result.includes(`    ${mutant.id}: ${mutant.description}`) &&
                        result.includes("    survived all laws"),
                ),
        });
    });
});
