# Checkout MFE coupon field and order pricing contract

This is a handoff for adding coupon entry and discount totals to the **Checkout MFE**. It is intentionally independent of the Discount Simulator UI. The Checkout MFE source is not present in this workspace, so this document identifies the Ordrz calls visible in the simulator integration and defines the order-pricing fields the Checkout MFE should consume. It does not claim that the proposed order fields already exist in the Orders API.

## Coupon field behavior

Add a coupon-code field to the checkout basket with **Apply** and **Remove** actions. Normalize user input by trimming whitespace and converting it to uppercase. Keep applied codes with the current cart, and send them to the server whenever the cart is recalculated or submitted for checkout.

The server is authoritative for coupon validity and savings. The client should display the server's validation result and refreshed totals; it must not declare a coupon valid based only on a locally cached coupon list or calculate the savings itself. Support multiple codes only if the pricing API permits them; do not assume the simulator's six-code UI limit is an API limit.

Suggested states:

- Empty: show a coupon input and Apply action.
- Applying: disable Apply and show progress.
- Applied: show the normalized code and a Remove action.
- Rejected: show the server's message beside the field and preserve the entered code so it can be corrected.
- Removed: recalculate the cart without that code.

Do not call the business coupon-code management endpoints from checkout. Those endpoints issue or manage codes for operators. Checkout should pass the customer's code to pricing or checkout.

## Confirmed Ordrz wiring in the simulator repository

The current simulator proxy maps these local routes to Ordrz:

| Purpose | Simulator proxy route | Ordrz route |
| --- | --- | --- |
| Recalculate a public cart | `POST /api/ordrz/calculate` | `POST /api/v1/public/cart/calculate` |
| Submit public checkout | `POST /api/ordrz/checkout` | `POST /api/v1/public/checkout/sessions` |
| Read a checkout session | `GET /api/ordrz/checkout/{checkoutId}` | `GET /api/v1/public/checkout/sessions/{checkoutId}` |
| List business orders | `GET /api/ordrz/orders` | `GET /api/v1/business/{businessId}/orders` |
| List/manage coupon codes (operator use) | `/api/ordrz/coupons...` | `/api/v1/business/{businessId}/discounts/{discountId}/codes...` |

The simulator sends `locationId`, `orderType`, `items` (`itemId`, `quantity`), and `couponCodes` to public cart calculation. Its public checkout request puts the same coupon codes on each order object, along with the location, order type, customer details, and item quantities. The checkout call uses an idempotency key. The proxy keeps the private business token server-side.

The simulator currently reads calculation response fields named `summary`, `lines`, and `appliedDiscounts`. It uses each line's `basePrice`, `lineTotal`, `discountTotal`, `total`, and tax totals, and summary fields including `grandTotal`, `taxSummary`, `deliveryCharges`, and `deliveryTax`. This describes the integration's current parsing, not a complete verified OpenAPI schema. Confirm field meanings and optionality against the Ordrz API owner before treating them as a stable Checkout MFE contract.

## Orders/pricing data Checkout MFE needs

Checkout must receive prices from the server for each line, plus server-calculated cart subtotals. The business-facing response should provide at least:

```json
{
  "currency": "PKR",
  "lines": [
    {
      "lineId": "line-123",
      "itemId": "item-456",
      "name": "Beef Chilli Dry & Chips",
      "quantity": 2,
      "originalUnitPrice": 1552.00,
      "originalExtendedPrice": 3104.00,
      "discountAmount": 1552.00,
      "discountedExtendedPrice": 1552.00
    }
  ],
  "pricing": {
    "subtotalBeforeDiscount": 3104.00,
    "discountTotal": 1552.00,
    "subtotalAfterDiscount": 1552.00
  }
}
```

These names are a proposed normalized Checkout MFE contract, not confirmed Ordrz response keys. The invariant should be:

`originalExtendedPrice = originalUnitPrice × quantity`

`subtotalAfterDiscount = subtotalBeforeDiscount − discountTotal`

If the API supports line-level rounding or allocations, return the actual server-calculated extended values rather than making the client recompute them. Return tax, delivery, fees, and grand total as separate server-calculated fields when Checkout needs to show them. Define whether discounts are allocated per line and ensure the line discount amounts reconcile with `discountTotal`.

Amounts in the simulator are parsed as decimal currency units and converted to minor units for its UI. The JSON above follows that observed convention for illustration; verify the currency precision and rounding rules for the Checkout MFE before implementation.

## Expected request and response flow

1. Checkout sends the current items, location, order type, and normalized `couponCodes` to the server pricing endpoint.
2. The server validates coupons, prices the cart, applies eligible promotions, and returns line prices and before/after-discount totals.
3. Checkout renders those returned values and coupon validation messages.
4. On submit, Checkout sends the same cart and coupon codes to checkout creation. The server recalculates and persists the authoritative prices; it must not trust totals supplied by the browser.
5. The created order, or a subsequent order detail response, exposes the persisted line prices and subtotal fields so order confirmation and order history can show the same amounts.

If checkout creation is asynchronous, the session response can acknowledge processing, but the completed order/detail response still needs to expose the persisted price breakdown. Do not treat a session's `amount` field as a substitute for line details or before/after-discount subtotals.

## Contract questions for the Orders API owner

The simulator source available here does not show a verified persisted-order detail schema. Confirm:

- Whether order detail currently returns original unit price and original extended price for every line.
- Whether it returns the server-calculated subtotal before discounts, discount total, and subtotal after discounts.
- Whether line totals are before or after discount, tax, and fees, and the exact semantics of `basePrice`, `lineTotal`, and `total`.
- Whether coupon validation errors are returned in the calculation response, as an API error, or both.
- Whether checkout recalculates prices and persists the same breakdown used by cart calculation.
- The currency precision and rounding/allocation policy.

If those fields are absent, add them to the Orders API response or expose a stable pricing DTO used by both cart calculation and order detail. The Checkout MFE should not reconstruct historical prices from the current product catalog.

## Source pointers

These are source files in the **Discount Simulator** workspace, not Checkout MFE files:

- `app/api/ordrz/[...resource]/route.ts` — Ordrz proxy mappings and private-token handling.
- `app/simulator/page.tsx` — example cart calculation request, coupon submission, and checkout session flow.
- `docs/ordrz-integration.md` — simulator integration overview and published API docs link.

The Checkout MFE repository/source path and its existing Orders SDK contract were not available in this workspace. The public API docs referenced by the simulator are at <https://apiv2.ordrz.com/docs/openapi.json>.
