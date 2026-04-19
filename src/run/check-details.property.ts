import { spec } from "property";

import { getCounterexampleInput } from "./get-counterexample-input.ts";

export const counterexampleSpec = spec(getCounterexampleInput, ({ property }) => {
    property("returns undefined when the check did not fail", {
        where: ({ input }) => !input.failed,
        holds: ({ result }) => result === undefined,
    });

    property("ignores counterexamples when the check did not fail", {
        where: ({ input }) =>
            !input.failed &&
            Array.isArray(input.counterexample) &&
            input.counterexample.length > 0 &&
            input.counterexample[0] !== undefined,
        holds: ({ result }) => result === undefined,
    });

    property("returns undefined when there is no counterexample", {
        where: ({ input }) => input.failed && !input.counterexample,
        holds: ({ result }) => result === undefined,
    });

    property("returns the first counterexample value when present", {
        where: ({ input }) =>
            input.failed && Array.isArray(input.counterexample) && input.counterexample.length > 0,
        holds: ({ input, result }) => result === input.counterexample?.[0],
    });
});
