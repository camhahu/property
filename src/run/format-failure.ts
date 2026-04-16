import type { LawSource } from "../load/analyze-spec-file.ts";
import { renderFailureText } from "./render-failure-text.ts";
import type { FailureDetails } from "./types.ts";

type FailureFormatRequest = {
    lawSources: Record<string, LawSource>;
    failure: FailureDetails;
    inputName: string;
    lawName: string;
};

function getLawSection(
    lawSources: Record<string, LawSource>,
    lawName: string,
): { location: string; snippet?: string } {
    const lawSource = lawSources[lawName];

    return {
        location: lawSource?.location ?? "unknown",
        snippet: lawSource?.snippet,
    };
}

export function formatFailure({
    failure,
    inputName,
    lawName,
    lawSources,
}: FailureFormatRequest): string {
    const lawSection = getLawSection(lawSources, lawName);

    return renderFailureText({
        calls: failure.calls,
        inputName,
        lawName,
        lawSnippet: lawSection.snippet,
        reason: failure.reason,
        sourceLocation: lawSection.location,
    });
}
