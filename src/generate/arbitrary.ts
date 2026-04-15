import {
    array,
    boolean,
    constant,
    constantFrom,
    oneof,
    record,
    string as stringArbitrary,
    tuple,
    type Arbitrary,
} from "fast-check";

import type { Shape } from "../types/shape.ts";

type ShapeBuilderMap = {
    [Kind in Shape["kind"]]: (shape: Extract<Shape, { kind: Kind }>) => Arbitrary<unknown>;
};

function arbitraryForObject(shape: Extract<Shape, { kind: "object" }>): Arbitrary<unknown> {
    const recordModel: Record<string, Arbitrary<unknown>> = {};
    const requiredKeys: string[] = [];

    for (const property of shape.properties) {
        recordModel[property.name] = arbitraryForShape(property.shape);

        if (!property.optional) {
            requiredKeys.push(property.name);
        }
    }

    return record(recordModel, { requiredKeys });
}

function arrayArbitrary(shape: Extract<Shape, { kind: "array" }>): Arbitrary<unknown> {
    const element = arbitraryForShape(shape.element);

    return oneof(
        constant([]),
        element.map((value) => [value]),
        array(element, { maxLength: 5 }),
    );
}

function numberArbitrary(): Arbitrary<number> {
    return constantFrom(0, 1, 1, 1, 1, 1, 2, 5, 10, 25, 50, 100, 5000, 5000, 5000, 5000, 5000);
}

const shapeBuilders: ShapeBuilderMap = {
    array: arrayArbitrary,
    boolean: () => boolean(),
    literal: (shape) => constant(shape.value),
    null: () => constant(null),
    number: () => numberArbitrary(),
    object: arbitraryForObject,
    string: () => stringArbitrary({ maxLength: 12 }),
    tuple: (shape) => tuple(...shape.items.map((item) => arbitraryForShape(item))),
    undefined: () => constant(void 0),
    union: (shape) => oneof(...shape.options.map((option) => arbitraryForShape(option))),
};

export function arbitraryForShape(shape: Shape): Arbitrary<unknown> {
    return shapeBuilders[shape.kind](shape as never);
}
