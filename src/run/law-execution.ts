import type { Awaitable, Given, InputContext, LawContext, LawDefinition } from "../public/spec.ts";
import { createDependencyBag } from "./dependencies.ts";
import type { CallTrace, FailureDetails } from "./types.ts";

type LawExecution<TInput, TResult> = {
    dependencyArgumentNames: Record<string, string[]>;
    dependencyParameterName?: string;
    given: Given<TInput>;
    input: TInput;
    law: LawDefinition<TInput, TResult> & { name: string };
    target: (...inputs: unknown[]) => Awaitable<TResult>;
};

class LawFailure extends Error {
    readonly details: FailureDetails;

    constructor(details: FailureDetails) {
        super(details.reason);
        this.details = details;
        this.name = "LawFailure";
    }
}

function toInputContext<TInput>(input: TInput): InputContext<TInput> {
    return { input };
}

async function shouldSkipLaw<TInput, TResult>({
    input,
    law,
}: Pick<LawExecution<TInput, TResult>, "input" | "law">): Promise<boolean> {
    if (!law.where) {
        return false;
    }

    return !(await law.where(toInputContext(input)));
}

export function getGiven<TInput, TResult>(law: LawDefinition<TInput, TResult>): Given<TInput> {
    return law.given ?? {};
}

function toLawContext<TInput, TResult>({
    input,
    result,
}: {
    input: TInput;
    result: TResult;
}): LawContext<TInput, TResult> {
    return { input, result };
}

function toLawFailure({
    calls,
    error,
    input,
}: {
    calls: CallTrace[];
    error: unknown;
    input: unknown;
}): LawFailure {
    if (error instanceof LawFailure) {
        return error;
    }

    let reason = String(error);

    if (error instanceof Error) {
        reason = error.message;
    }

    return new LawFailure({ calls, input, reason });
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

export async function executeLaw<TInput, TResult>({
    dependencyArgumentNames,
    dependencyParameterName,
    given,
    input,
    law,
    target,
}: LawExecution<TInput, TResult>): Promise<void> {
    const calls: CallTrace[] = [];

    try {
        if (await shouldSkipLaw({ input, law })) {
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
        const passed = await law.holds(toLawContext({ input, result }));

        if (!passed) {
            throw new LawFailure({ calls, input, reason: "Law returned false.", result });
        }
    } catch (error) {
        throw toLawFailure({ calls, error, input });
    }
}
