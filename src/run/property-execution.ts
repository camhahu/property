import type {
    Awaitable,
    Given,
    InputContext,
    PropertyContext,
    PropertyDefinition,
} from "../public/spec.ts";
import { createDependencyBag } from "./dependencies.ts";
import type { CallTrace, FailureDetails } from "./types.ts";

type PropertyExecution<TInput, TResult> = {
    dependencyArgumentNames: Record<string, string[]>;
    dependencyParameterName?: string;
    given: Given<TInput>;
    input: TInput;
    property: PropertyDefinition<TInput, TResult> & { name: string };
    target: (...inputs: unknown[]) => Awaitable<TResult>;
};

class PropertyFailure extends Error {
    readonly details: FailureDetails;

    constructor(details: FailureDetails) {
        super(details.reason);
        this.details = details;
        this.name = "PropertyFailure";
    }
}

function toInputContext<TInput>(input: TInput): InputContext<TInput> {
    return { input };
}

async function shouldSkipProperty<TInput, TResult>({
    input,
    property,
}: Pick<PropertyExecution<TInput, TResult>, "input" | "property">): Promise<boolean> {
    if (!property.where) {
        return false;
    }

    return !(await property.where(toInputContext(input)));
}

export function getGiven<TInput, TResult>(
    property: PropertyDefinition<TInput, TResult>,
): Given<TInput> {
    return property.given ?? {};
}

function toPropertyContext<TInput, TResult>({
    input,
    result,
}: {
    input: TInput;
    result: TResult;
}): PropertyContext<TInput, TResult> {
    return { input, result };
}

function toPropertyFailure({
    calls,
    error,
    input,
}: {
    calls: CallTrace[];
    error: unknown;
    input: unknown;
}): PropertyFailure {
    if (error instanceof PropertyFailure) {
        return error;
    }

    let reason = String(error);

    if (error instanceof Error) {
        reason = error.message;
    }

    return new PropertyFailure({ calls, input, reason });
}

async function invokeTarget<TInput, TResult>({
    calls,
    dependencyArgumentNames,
    dependencyParameterName,
    given,
    input,
    target,
}: {
    calls: CallTrace[];
    dependencyArgumentNames: Record<string, string[]>;
    dependencyParameterName?: string;
    given: Given<TInput>;
    input: TInput;
    target: (...inputs: unknown[]) => Awaitable<TResult>;
}): Promise<TResult> {
    try {
        let result: TResult;

        if (dependencyParameterName) {
            result = await target(
                input,
                createDependencyBag({ dependencyArgumentNames, given, input }),
            );
        } else {
            result = await target(input);
        }

        calls.push({ input, result });
        return result;
    } catch (error) {
        let reason = String(error);

        if (error instanceof Error) {
            reason = error.message;
        }

        calls.push({ error: reason, input });
        throw error;
    }
}

export async function executeProperty<TInput, TResult>({
    dependencyArgumentNames,
    dependencyParameterName,
    given,
    input,
    property,
    target,
}: PropertyExecution<TInput, TResult>): Promise<void> {
    const calls: CallTrace[] = [];

    try {
        if (await shouldSkipProperty({ input, property })) {
            return;
        }

        const result = await invokeTarget({
            calls,
            dependencyArgumentNames,
            dependencyParameterName,
            given,
            input,
            target,
        });
        const passed = await property.holds(toPropertyContext({ input, result }));

        if (!passed) {
            throw new PropertyFailure({ calls, input, reason: "Law returned false.", result });
        }
    } catch (error) {
        throw toPropertyFailure({ calls, error, input });
    }
}
