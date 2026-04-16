import type { MutationResult } from "../mutate/run-mutants.ts";

export function renderMutationReport(results: MutationResult[]): string {
    if (results.length === 0) {
        return [
            "",
            "  Mutations",
            "    no supported mutation candidates",
            "",
            "  confidence: unavailable",
        ].join("\n");
    }

    const killed = results.filter((result) => result.killed);
    const survived = results.filter((result) => !result.killed);
    const confidence = Math.round((killed.length / results.length) * 100);
    const lines = ["", "  Mutations", `    killed ${killed.length}/${results.length}`];

    if (survived.length > 0) {
        lines.push("", "  Weak laws");
        lines.push(
            ...survived.flatMap((mutant) => [
                `    ${mutant.id}: ${mutant.description}`,
                "    survived all laws",
            ]),
        );
    }

    lines.push("", `  confidence: ${confidence}%`);
    return lines.join("\n");
}
