# Simulator coupon field

This document describes the coupon-code inputs in **Discount simulator → Build a basket**. It covers the coupon UI and code-management API wiring, not discount calculation or checkout totals.

## Where the field appears

The simulator currently has two coupon inputs, both connected to the same coupon text and apply action:

- **Order items**: the field below the basket lines, with the placeholder `Coupon code`.
- **Live calculation**: the field in the `Apply coupon` panel, with the placeholder `e.g. BOGO10`.

Applying a code adds a removable coupon chip. The code is trimmed and converted to uppercase before it is checked.

## Apply behavior

The field accepts a code only when it exists in the simulator's loaded coupon records, or when a loaded discount is configured for `CODE` application and has a matching `rules.couponCode` value.

The UI prevents duplicate application and limits a basket to six coupon codes. It rejects unknown codes and coupons that are inactive or expired against the simulator's configured time. Applied codes appear as chips; the chip's remove button removes that code from the current basket.

Messages shown by the field include:

- `That coupon is already applied.`
- `A maximum of six coupon codes can be applied.`
- `Coupon not found. Create this code for the offer first.`
- `This coupon is inactive or expired.`
- `<CODE> applied.`

## Coupon records and Ordrz API

When the Ordrz coupon API is configured, the simulator loads coupon records through `GET /api/ordrz/coupons`. The local proxy reads discounts from Ordrz and flattens each discount's `codes` into coupon records, adding the owning `discountId`.

The coupon-management screen can issue a code with `POST /api/ordrz/coupons` using a `discountId` and code. The proxy sends it to the associated business discount's codes endpoint:

```text
POST /api/v1/business/{businessId}/discounts/{discountId}/codes
```

The coupon library can activate/deactivate a code and disable it through the same codes endpoint. Without Ordrz configured, coupon records remain local to the simulator browser.

A coupon record has this shape:

```ts
{
  id: string
  discountId: string
  code: string
  isActive: boolean
  startAt: string | null
  endAt: string | null
  maxUses: number | null
  usesPerCustomer: number | null
}
```

## Source files

- `app/simulator/page.tsx` — coupon inputs, apply/remove behavior, coupon library, and code create/disable calls.
- `app/api/ordrz/[...resource]/route.ts` — local proxy for listing and managing Ordrz coupon codes.
- `lib/offline-simulator.ts` — local `Coupon` record and simulator state types.
