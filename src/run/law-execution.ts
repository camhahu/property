import type {
    Awaitable,
    Given,
    InputContext,
    Law,
    LawContext,
    LawDefinition,
    NamedInputs,
    StructuredLaw,
} from "../public/spec.ts";
import { toNamedInputs } from "../runtime/named-values.ts";
import { createDependencyBag } from "./dependencies.ts";
import type { CallTrace, FailureDetails } from "./types.ts";

type LawExecution<TArgs extends unknown[], TResult> = {
    dependencyArgumentNames: Record<string, string[]>;
    dependencyParameterName?: string;
    given: Given<TArgs>;
    inputNames: string[];
    inputs: TArgs;
    law: LawDefinition<TArgs, TResult>;
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

function toInputContext<TArgs extends unknown[]>(
    inputNames: string[],
    inputs: TArgs,
): InputContext<TArgs> {
    return {
        inputs: toNamedInputs(inputNames, inputs) as NamedInputs<TArgs>,
        values: inputs,
    };
}

function isStructuredLaw<TArgs extends unknown[], TResult>(
    law: LawDefinition<TArgs, TResult>,
): law is StructuredLaw<TArgs, TResult> {
    return typeof law !== "function";
}

async function shouldSkipLaw<TArgs extends unknown[], TResult>({
    inputNames,
    inputs,
    law,
}: Pick<LawExecution<TArgs, TResult>, "inputNames" | "inputs" | "law">): Promise<boolean> {
    return isStructuredLaw(law) && law.when
        ? !(await law.when(toInputContext(inputNames, inputs)))
        : false;
}

function getAssertion<TArgs extends unknown[], TResult>(
    law: LawDefinition<TArgs, TResult>,
): Law<TArgs, TResult> {
    return isStructuredLaw(law) ? law.assert : law;
}

export function getGiven<TArgs extends unknown[], TResult>(
    law: LawDefinition<TArgs, TResult>,
): Given<TArgs> {
    return isStructuredLaw(law) && law.given ? law.given : {};
}

function toLawContext<TArgs extends unknown[], TResult>({
    inputNames,
    inputs,
    result,
}: {
    inputNames: string[];
    inputs: TArgs;
    result: TResult;
}): LawContext<TArgs, TResult> {
    return {
        ...toInputContext(inputNames, inputs),
        result,
    };
}

function toLawFailure({
    calls,
    error,
    inputs,
}: {
    calls: CallTrace[];
    error: unknown;
    inputs: unknown[];
}): LawFailure {
    if (error instanceof LawFailure) {
        return error;
    }

    const reason = error instanceof Error ? error.message : String(error);
    return new LawFailure({ calls, inputs, reason });
}

async function invokeTarget<TArgs extends unknown[], TResult>({
    calls,
    dependencyArgumentNames,
    dependencyParameterName,
    given,
    inputNames,
    inputs,
    target,
}: {
    calls: CallTrace[];
    dependencyArgumentNames: Record<string, string[]>;
    dependencyParameterName?: string;
    given: Given<TArgs>;
    inputNames: string[];
    inputs: TArgs;
    target: (...inputs: unknown[]) => Awaitable<TResult>;
}): Promise<TResult> {
    try {
        const result = dependencyParameterName
            ? await target(
                  ...inputs,
                  createDependencyBag({ dependencyArgumentNames, given, inputNames, inputs }),
              )
            : await target(...inputs);

        calls.push({ inputs, kind: "generated", result });
        return result;
    } catch (error) {
        calls.push({
            error: error instanceof Error ? error.message : String(error),
            inputs,
            kind: "generated",
        });
        throw error;
    }
}

export async function executeLaw<TArgs extends unknown[], TResult>({
    dependencyArgumentNames,
    dependencyParameterName,
    given,
    inputNames,
    inputs,
    law,
    target,
}: LawExecution<TArgs, TResult>): Promise<void> {
    const calls: CallTrace[] = [];

    try {
        if (await shouldSkipLaw({ inputNames, inputs, law })) {
            return;
        }

        const result = await invokeTarget({
            calls,
            dependencyArgumentNames,
            dependencyParameterName,
            given,
            inputNames,
            inputs,
            target,
        });
        const passed = await getAssertion(law)(toLawContext({ inputNames, inputs, result }));

        if (!passed) {
            throw new LawFailure({ calls, inputs, reason: "Law returned false.", result });
        }
    } catch (error) {
        throw toLawFailure({ calls, error, inputs });
    }
}
