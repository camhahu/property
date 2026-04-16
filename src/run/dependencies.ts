import type { Given, MockContext, MockDefinition, MockExpectation } from "../public/spec.ts";
import { toNamedArgs } from "../runtime/named-values.ts";

function isMockExpectation<TInput>(
    definition: MockDefinition<TInput>,
): definition is MockExpectation<TInput> {
    return typeof definition === "object" && definition !== null && "where" in definition;
}

function toMockContext<TInput>({
    argNames,
    input,
    values,
}: {
    argNames: string[];
    input: TInput;
    values: unknown[];
}): MockContext<TInput> {
    return {
        args: toNamedArgs(argNames, values),
        input,
    };
}

function resolveMockDefinition<TInput>({
    context,
    definition,
    name,
}: {
    context: MockContext<TInput>;
    definition: MockDefinition<TInput>;
    name: string;
}): Promise<unknown> {
    if (typeof definition === "function") {
        return Promise.resolve(definition(context));
    }

    if (!isMockExpectation(definition)) {
        return Promise.resolve(definition);
    }

    return resolveMockExpectation({ context, expectation: definition, name });
}

async function resolveMockExpectation<TInput>({
    context,
    expectation,
    name,
}: {
    context: MockContext<TInput>;
    expectation: MockExpectation<TInput>;
    name: string;
}): Promise<unknown> {
    if (!(await expectation.where(context))) {
        throw new Error(`Mock expectation failed for ${name}.`);
    }

    if (expectation.returns) {
        return expectation.returns(context);
    }

    return expectation.return;
}

export function createDependencyBag<TInput>({
    dependencyArgumentNames,
    given,
    input,
}: {
    dependencyArgumentNames: Record<string, string[]>;
    given: Given<TInput>;
    input: TInput;
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
                        input,
                        values,
                    }),
                    definition,
                    name,
                }),
        ]),
    );
}
