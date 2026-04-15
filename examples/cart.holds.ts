import { spec } from "holds";

import {
    calculateCartSummary,
    type CartItem,
    type CartSummary,
    type CheckoutInput,
} from "./cart.ts";

function itemCountOf(items: CartItem[]): number {
    return items.reduce((count, item) => count + item.quantity, 0);
}

function subtotalOf(items: CartItem[]): number {
    return items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
}

function fragileLineCount(items: CartItem[]): number {
    return items.filter((item) => item.fragile).length;
}

function isZeroSummary(result: CartSummary): boolean {
    return Object.values(result).every((value) => value === 0);
}

function hasCouponCode(input: CheckoutInput): boolean {
    return Boolean(input.couponCode?.trim());
}

function normalizedCouponCode(input: CheckoutInput): string | undefined {
    return input.couponCode?.trim();
}

function hasPositiveSubtotal(input: CheckoutInput): boolean {
    return subtotalOf(input.cart.items) > 0;
}

function isPaidShippingCase(input: CheckoutInput): boolean {
    return itemCountOf(input.cart.items) > 0 && subtotalOf(input.cart.items) < 5000;
}

const noCoupon = {
    fetchCoupon: () => Promise.resolve(null),
};

export const cartSpec = spec(calculateCartSummary, {
    "empty cart stays empty": {
        given: noCoupon,
        when: ({ inputs }) => itemCountOf(inputs.cart.items) === 0,
        assert: ({ result }) => isZeroSummary(result),
    },

    "item count matches quantities": {
        given: noCoupon,
        assert: ({ inputs, result }) => result.itemCount === itemCountOf(inputs.cart.items),
    },

    "subtotal matches unit price times quantity": {
        given: noCoupon,
        assert: ({ inputs, result }) => result.subtotal === subtotalOf(inputs.cart.items),
    },

    "shipping is zero at or above threshold": {
        given: noCoupon,
        when: ({ inputs }) => subtotalOf(inputs.cart.items) >= 5000,
        assert: ({ result }) => result.shipping === 0,
    },

    "shipping is zero exactly at the threshold": {
        given: noCoupon,
        sample: {
            cart: {
                items: [{ fragile: false, quantity: 1, unitPriceCents: 5000 }],
                membership: "standard",
            },
        },
        assert: ({ result }) => result.shipping === 0,
    },

    "standard shipping matches the published formula": {
        given: noCoupon,
        when: ({ inputs }) => isPaidShippingCase(inputs) && inputs.cart.membership === "standard",
        assert: ({ inputs, result }) =>
            result.shipping === 700 + fragileLineCount(inputs.cart.items) * 200,
    },

    "premium shipping halves the paid shipping formula": {
        given: noCoupon,
        when: ({ inputs }) => isPaidShippingCase(inputs) && inputs.cart.membership === "premium",
        assert: ({ inputs, result }) =>
            result.shipping === Math.floor((700 + fragileLineCount(inputs.cart.items) * 200) / 2),
    },

    "missing coupon means no discount": {
        when: ({ inputs }) => !hasCouponCode(inputs),
        given: {
            fetchCoupon: {
                return: null,
                when: ({ inputs }) => hasCouponCode(inputs),
            },
        },
        assert: ({ result }) => result.discount === 0,
    },

    "coupon code is passed to fetchCoupon": {
        when: ({ inputs }) => hasPositiveSubtotal(inputs) && hasCouponCode(inputs),
        given: {
            fetchCoupon: {
                return: { type: "percent", value: 10 },
                when: ({ args, inputs }) => args.code === normalizedCouponCode(inputs),
            },
        },
        assert: ({ inputs, result }) =>
            result.discount === Math.round(subtotalOf(inputs.cart.items) * 0.1),
    },

    "100 percent coupon makes the subtotal free": {
        when: ({ inputs }) => hasPositiveSubtotal(inputs) && hasCouponCode(inputs),
        given: {
            fetchCoupon: {
                return: { type: "percent", value: 100 },
                when: ({ args, inputs }) => args.code === normalizedCouponCode(inputs),
            },
        },
        assert: ({ inputs, result }) =>
            result.discount === subtotalOf(inputs.cart.items) && result.total === result.shipping,
    },

    "fixed coupons clamp at the subtotal": {
        when: ({ inputs }) => hasPositiveSubtotal(inputs) && hasCouponCode(inputs),
        given: {
            fetchCoupon: {
                return: { type: "fixed", value: 4000 },
                when: ({ args, inputs }) => args.code === normalizedCouponCode(inputs),
            },
        },
        assert: ({ inputs, result }) =>
            result.discount === Math.min(subtotalOf(inputs.cart.items), 4000),
    },

    "negative fixed coupons are ignored": {
        when: ({ inputs }) => hasCouponCode(inputs),
        given: {
            fetchCoupon: {
                return: { type: "fixed", value: -25 },
                when: ({ args, inputs }) => args.code === normalizedCouponCode(inputs),
            },
        },
        assert: ({ result }) => result.discount === 0,
    },

    "negative percent coupons are ignored": {
        when: ({ inputs }) => hasCouponCode(inputs),
        given: {
            fetchCoupon: {
                return: { type: "percent", value: -25 },
                when: ({ args, inputs }) => args.code === normalizedCouponCode(inputs),
            },
        },
        assert: ({ result }) => result.discount === 0,
    },

    "total balances subtotal discount and shipping": {
        given: noCoupon,
        assert: ({ result }) =>
            result.total === result.subtotal - result.discount + result.shipping,
    },
});
