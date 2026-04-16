# holds

`holds` is an opinionated property and mutation testing tool for exported TypeScript business functions.

The intended authoring model is:

```ts
import { spec } from "holds";

import { calculateCartSummary } from "./cart.ts";

export const cartSpec = spec(calculateCartSummary, ({ law, section }) => {
    section("totals", () => {
        law("item count matches quantities", {
            holds: ({ input, result }) =>
                result.itemCount ===
                input.cart.items.reduce((count, item) => count + item.quantity, 0),
        });
    });
});
```

## Vision

- Specs target real production exports.
- Inputs come from TypeScript types when they are plain data.
- Dependencies are injected as data from `given`, not through test-only wrappers.
- Mutation results help show whether the laws actually bite.

## Scope

`holds` is intentionally narrow.

- Best fit: exported functions with one business-input parameter and an optional second dependency bag.
- Best fit inputs: plain data like objects, arrays, tuples, records, unions, literals, booleans, numbers, strings, `null`, `undefined`, and `unknown`.
- Best fit dependencies: functions grouped under the second parameter and overridden with `given`.

Today it does not try to be a general-purpose test framework or a universal TypeScript value generator.

- Recursive input types are not supported.
- Input generation stays biased toward small, readable values.
- Mutation confidence only reflects the mutations this repo currently knows how to generate.

## Commands

Install dependencies:

```bash
bun install
```

Run the example spec:

```bash
bun run ./src/cli.ts run ./examples/cart.holds.ts
```

Run repo checks:

```bash
bun run check
```

## Notes On Reports

- Property output shows each law and the first failing counterexample.
- Mutation output is only meaningful for supported mutation candidates.
- `confidence: unavailable` means the target did not contain any currently supported mutation candidates, not that the spec is perfect.

## Example

See `examples/cart.ts` and `examples/cart.holds.ts` for the canonical style.
