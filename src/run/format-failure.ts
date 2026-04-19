import type { PropertySource } from "../load/analyze-spec-file.ts";
import { renderFailureText } from "./render-failure-text.ts";
import type { FailureDetails } from "./types.ts";

type FailureFormatRequest = {
    propertySources: Record<string, PropertySource>;
    failure: FailureDetails;
    inputName: string;
    propertyName: string;
};

function getLawSection(
    propertySources: Record<string, PropertySource>,
    propertyName: string,
): { location: string; snippet?: string } {
    const propertySource = propertySources[propertyName];

    return {
        location: propertySource?.location ?? "unknown",
        snippet: propertySource?.snippet,
    };
}

export function formatFailure({
    failure,
    inputName,
    propertyName,
    propertySources,
}: FailureFormatRequest): string {
    const lawSection = getLawSection(propertySources, propertyName);

    return renderFailureText({
        calls: failure.calls,
        inputName,
        propertyName,
        propertySnippet: lawSection.snippet,
        reason: failure.reason,
        sourceLocation: lawSection.location,
    });
}
