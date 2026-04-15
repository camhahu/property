export type NamedRecord = Record<string, unknown>;

export function toNamedArgs(names: string[], values: unknown[]): NamedRecord {
    return Object.fromEntries(names.map((name, index) => [name, values[index]]));
}

export function toNamedInputs(inputNames: string[], values: unknown[]): unknown {
    if (values.length === 1) {
        return values[0];
    }

    return toNamedArgs(inputNames, values);
}
