import {
    array,
    boolean,
    constant,
    integer,
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

const shapeBuilders: ShapeBuilderMap = {
    array: (shape) => array(arbitraryForShape(shape.element), { maxLength: 5 }),
    boolean: () => boolean(),
    literal: (shape) => constant(shape.value),
    null: () => constant(null),
    number: () => integer({ max: 100, min: 0 }),
    object: arbitraryForObject,
    string: () => stringArbitrary({ maxLength: 12 }),
    tuple: (shape) => tuple(...shape.items.map((item) => arbitraryForShape(item))),
    undefined: () => constant(void 0),
    union: (shape) => oneof(...shape.options.map((option) => arbitraryForShape(option))),
};

export function arbitraryForShape(shape: Shape): Arbitrary<unknown> {
    return shapeBuilders[shape.kind](shape as never);
}
