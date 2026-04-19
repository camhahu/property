# property

Opinionated property and mutation testing for TypeScript business functions.

`property` generates inputs from your TypeScript types, checks properties you declare about the function's behavior, then mutates the function's source to verify those properties actually detect bugs.

## Install

```bash
npm install --save-dev property
```

## Quick start

Say you have a function you want to pin down:

```ts
// discount.ts
export function discountFor(subtotal: number, percent: number): number {
    const bounded = Math.min(Math.max(percent, 0), 100);
    return Math.round((subtotal * bounded) / 100);
}
```

Write a spec next to it:

```ts
// discount.property.ts
import { spec } from "property";

import { discountFor } from "./discount.ts";

export const discountSpec = spec(discountFor, ({ property }) => {
    property("discount is never negative", {
        holds: ({ result }) => result >= 0,
    });

    property("discount never exceeds the subtotal", {
        holds: ({ input, result }) => result <= input,
    });
});
```

Run it:

```bash
npx property run ./discount.property.ts
```

```
discount.property.ts
  discountFor    2 properties

    ✓ discountFor / discount is never negative    250 inputs
    ✓ discountFor / discount never exceeds the subtotal    250 inputs

  Mutations
    killed 3/3

  confidence: 100%
```

## How it works

`property` takes one exported function as its target. It reads the TypeScript types of the function's input, generates random values against those types, and runs each property over many inputs. When the property run passes, it mutates your function's source (for example, flipping a comparison operator or removing a guard clause) and reruns the properties against each mutated version. A mutation that survives means the properties weren't specific enough to catch that change.

Properties are automatically namespaced by the target function's name so output stays scannable across specs.

## Spec shape

```ts
spec(target, ({ property }) => {
    property("property name", {
        given: {
            // optional: override dependencies
        },
        where: ({ input }) => /* optional filter */ true,
        holds: ({ input, result }) => /* must be true */ true,
    });
});
```

- `target` — the function under test. Its name becomes the output namespace.
- `property` — a named property with a `holds` predicate.
- `where` — filter inputs the property should apply to.
- `given` — override dependencies for this property (see below).

## Dependencies

If your function takes a second argument that's a bag of dependencies, `property` detects it and mocks each one from the types:

```ts
type Services = {
    fetchCoupon: (code: string) => Promise<Coupon | null>;
};

export async function checkout(input: CheckoutInput, services: Services) {
    // ...
}
```

Override individual dependencies per property with `given`:

```ts
property("100 percent coupon zeroes the subtotal", {
    where: ({ input }) => Boolean(input.couponCode),
    given: {
        fetchCoupon: { type: "percent", value: 100 },
    },
    holds: ({ result }) => result.discount === result.subtotal,
});
```

A `given` value can be a plain value, a handler function, or an object with `return` / `returns` and a `where` predicate for call-argument matching.

A richer end-to-end example lives in [`examples/cart.property.ts`](./examples/cart.property.ts).

## Reports

**Property output** lists each property, the number of inputs run, and the first failing counterexample if any.

**Mutation output** shows `killed N/M` and a `confidence` percentage. If the target contains no currently supported mutation candidates, it reports `confidence: unavailable` rather than inventing a score.

## Scope

`property` is intentionally narrow. It fits best when:

- The function has one business-input parameter and an optional dependency bag.
- The input is plain data: objects, arrays, tuples, records, unions, literals, booleans, numbers, strings, `null`, `undefined`, `unknown`.
- Dependencies are grouped under a single object parameter.

Today, `property` does not:

- Support recursive input types.
- Generate large or exotic values — inputs stay small and readable.
- Cover every possible mutation. Confidence reflects the currently supported mutation candidates.

## Requirements

- Node.js 20+
- A TypeScript project (spec files are loaded with `tsx`)

## License

MIT
