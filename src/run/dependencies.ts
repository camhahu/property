import type {
    Given,
    MockContext,
    MockDefinition,
    MockExpectation,
    NamedInputs,
} from "../public/spec.ts";
import { toNamedArgs, toNamedInputs } from "../runtime/named-values.ts";

function isMockExpectation<TArgs extends unknown[]>(
    definition: MockDefinition<TArgs>,
): definition is MockExpectation<TArgs> {
    return typeof definition !== "function";
}

function toMockContext<TArgs extends unknown[]>({
    argNames,
    inputNames,
    inputValues,
    values,
}: {
    argNames: string[];
    inputNames: string[];
    inputValues: TArgs;
    values: unknown[];
}): MockContext<TArgs> {
    return {
        args: toNamedArgs(argNames, values),
        inputs: toNamedInputs(inputNames, inputValues) as NamedInputs<TArgs>,
        values: inputValues,
    };
}

async function resolveMockDefinition<TArgs extends unknown[]>({
    context,
    definition,
    name,
}: {
    context: MockContext<TArgs>;
    definition: MockDefinition<TArgs>;
    name: string;
}): Promise<unknown> {
    if (!isMockExpectation(definition)) {
        return definition(context);
    }

    if (!(await definition.when(context))) {
        throw new Error(`Mock expectation failed for ${name}.`);
    }

    return definition.returns ? definition.returns(context) : definition.return;
}

export function createDependencyBag<TArgs extends unknown[]>({
    dependencyArgumentNames,
    given,
    inputNames,
    inputs,
}: {
    dependencyArgumentNames: Record<string, string[]>;
    given: Given<TArgs>;
    inputNames: string[];
    inputs: TArgs;
}): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(given).map(([name, definition]) => [
            name,
            (...values: unknown[]) =>
                resolveMockDefinition({
                    context: toMockContext({
                        argNames:
                            dependencyArgumentNames[name] ??
                            values.map((_, index) => `arg${index}`),
                        inputNames,
                        inputValues: inputs,
                        values,
                    }),
                    definition,
                    name,
                }),
        ]),
    );
}
