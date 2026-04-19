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

export type Holds<TInput, TResult> = (
    context: PropertyContext<TInput, TResult>,
) => Awaitable<boolean>;

export type PropertyContext<TInput, TResult> = InputContext<TInput> & {
    result: TResult;
};

export type PropertyDefinition<TInput, TResult> = {
    holds: Holds<TInput, TResult>;
    given?: Given<TInput>;
    where?: (context: InputContext<TInput>) => Awaitable<boolean>;
};

export type CollectedProperty<TInput, TResult> = PropertyDefinition<TInput, TResult> & {
    name: string;
};

export type SpecBuilder<TInput, TResult> = {
    property: (name: string, definition: PropertyDefinition<TInput, TResult>) => void;
};

export type SpecDefinition<TInput, TResult> = {
    readonly __brand: "property-spec";
    readonly target: (...inputs: any[]) => Awaitable<TResult>;
    readonly properties: CollectedProperty<TInput, TResult>[];
};

export function spec<TInput, TResult>(
    target: (input: TInput) => Awaitable<TResult>,
    build: (builder: SpecBuilder<TInput, TResult>) => void,
): SpecDefinition<TInput, TResult>;

export function spec<TInput, TDependencies, TResult>(
    target: (input: TInput, dependencies: TDependencies) => Awaitable<TResult>,
    build: (builder: SpecBuilder<TInput, TResult>) => void,
): SpecDefinition<TInput, TResult>;

export function spec(
    target: (...inputs: any[]) => Awaitable<any>,
    build: (builder: SpecBuilder<any, any>) => void,
): SpecDefinition<any, any> {
    const properties: CollectedProperty<any, any>[] = [];
    const prefix = buildNamespacePrefix(target);

    build({
        property(name, definition) {
            properties.push({ ...definition, name: `${prefix}${name}` });
        },
    });

    return {
        __brand: "property-spec",
        properties,
        target,
    };
}

function buildNamespacePrefix(target: (...inputs: any[]) => Awaitable<any>): string {
    const name = target.name.trim();

    if (!name) {
        return "";
    }

    return `${name} / `;
}
