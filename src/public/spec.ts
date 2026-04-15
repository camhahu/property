export type Awaitable<T> = Promise<T> | T;

export type InputContext<TInput> = {
    input: TInput;
};

export type MockContext<TInput> = InputContext<TInput> & {
    args: Record<string, unknown>;
};

export type MockHandler<TInput> = (context: MockContext<TInput>) => Awaitable<unknown>;

export type MockExpectation<TInput> = {
    return?: unknown;
    returns?: MockHandler<TInput>;
    where: (context: MockContext<TInput>) => Awaitable<boolean>;
};

export type MockValue = null | boolean | number | string | Record<string, unknown> | unknown[];

export type MockDefinition<TInput> = MockExpectation<TInput> | MockHandler<TInput> | MockValue;

export type Given<TInput> = Record<string, MockDefinition<TInput>>;

export type Holds<TInput, TResult> = (context: LawContext<TInput, TResult>) => Awaitable<boolean>;

export type LawContext<TInput, TResult> = InputContext<TInput> & {
    result: TResult;
};

export type LawDefinition<TInput, TResult> = {
    holds: Holds<TInput, TResult>;
    given?: Given<TInput>;
    where?: (context: InputContext<TInput>) => Awaitable<boolean>;
};

export type CollectedLaw<TInput, TResult> = LawDefinition<TInput, TResult> & {
    name: string;
};

export type SpecBuilder<TInput, TResult> = {
    section: (name: string, build: () => void) => void;
    law: (name: string, definition: LawDefinition<TInput, TResult>) => void;
};

export type SpecDefinition<TInput, TResult> = {
    readonly __brand: "holds-spec";
    readonly target: (...inputs: any[]) => Awaitable<TResult>;
    readonly laws: CollectedLaw<TInput, TResult>[];
};

export function spec<TInput, TDependencies, TResult>(
    target: (input: TInput, dependencies: TDependencies) => Awaitable<TResult>,
    build: (builder: SpecBuilder<TInput, TResult>) => void,
): SpecDefinition<TInput, TResult>;

export function spec<TInput, TResult>(
    target: (input: TInput) => Awaitable<TResult>,
    build: (builder: SpecBuilder<TInput, TResult>) => void,
): SpecDefinition<TInput, TResult>;

export function spec(
    target: (...inputs: any[]) => Awaitable<any>,
    build: (builder: SpecBuilder<any, any>) => void,
): SpecDefinition<any, any> {
    const laws: CollectedLaw<any, any>[] = [];
    const sections: string[] = [];

    build({
        section(name, next) {
            sections.push(name);

            try {
                next();
            } finally {
                sections.pop();
            }
        },
        law(name, definition) {
            laws.push({
                ...definition,
                name: sections.length > 0 ? `${sections.join(" / ")} / ${name}` : name,
            });
        },
    });

    return {
        __brand: "holds-spec",
        laws,
        target,
    };
}
