export type Awaitable<T> = Promise<T> | T;

export type NamedInputs<TArgs extends unknown[]> = TArgs extends [infer TInput]
    ? TInput
    : Record<string, unknown>;

export type InputContext<TArgs extends unknown[]> = {
    inputs: NamedInputs<TArgs>;
    values: TArgs;
};

export type MockContext<TArgs extends unknown[]> = InputContext<TArgs> & {
    args: Record<string, unknown>;
};

export type MockHandler<TArgs extends unknown[]> = (
    context: MockContext<TArgs>,
) => Awaitable<unknown>;

export type MockExpectation<TArgs extends unknown[]> = {
    return?: unknown;
    returns?: MockHandler<TArgs>;
    when: (context: MockContext<TArgs>) => Awaitable<boolean>;
};

export type MockDefinition<TArgs extends unknown[]> = MockExpectation<TArgs> | MockHandler<TArgs>;

export type Given<TArgs extends unknown[]> = Record<string, MockDefinition<TArgs>>;

export type LawContext<TArgs extends unknown[], TResult> = InputContext<TArgs> & {
    result: TResult;
};

export type Law<TArgs extends unknown[], TResult> = (
    context: LawContext<TArgs, TResult>,
) => Awaitable<boolean>;

export type When<TArgs extends unknown[]> = (context: InputContext<TArgs>) => Awaitable<boolean>;

export type StructuredLaw<TArgs extends unknown[], TResult> = {
    assert: Law<TArgs, TResult>;
    given?: Given<TArgs>;
    sample?: NamedInputs<TArgs>;
    when?: When<TArgs>;
};

export type LawDefinition<TArgs extends unknown[], TResult> =
    | Law<TArgs, TResult>
    | StructuredLaw<TArgs, TResult>;

export type SpecDefinition<TArgs extends unknown[], TResult> = {
    readonly __brand: "holds-spec";
    readonly laws: Record<string, LawDefinition<TArgs, TResult>>;
    readonly target: (...inputs: unknown[]) => Awaitable<TResult>;
};

export function spec<TArgs extends unknown[], TDependencies, TResult>(
    target: (...inputs: [...TArgs, TDependencies]) => Awaitable<TResult>,
    laws: Record<string, LawDefinition<TArgs, TResult>>,
): SpecDefinition<TArgs, TResult>;

export function spec<TArgs extends unknown[], TResult>(
    target: (...inputs: TArgs) => Awaitable<TResult>,
    laws: Record<string, LawDefinition<TArgs, TResult>>,
): SpecDefinition<TArgs, TResult>;

export function spec(
    target: (...inputs: any[]) => Awaitable<any>,
    laws: Record<string, LawDefinition<any[], any>>,
): SpecDefinition<unknown[], unknown> {
    return {
        __brand: "holds-spec",
        laws,
        target,
    };
}
