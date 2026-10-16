# Simulator product-card discount labels

This document covers the discount UI shown on product cards in **Discount simulator → Build a basket**. It describes the promotional badges on menu cards, not discount calculation, eligibility decisions, totals, or checkout behavior.

## What appears on a product card

- If a product has at least one attached promotion, a pink label appears over the top-left of its image.
- The label text uses the promotion's `label`; if that is missing, it uses the promotion's `name`.
- Hovering the label shows the promotion name as its tooltip.
- If a product has multiple attached promotions, the card shows a `+N more offer(s)` indicator beside the price. The badge displays the first promotion in the list.
- If that first promotion has `isConditional: true`, the card shows **Conditions apply** below the price.
- Products without attached promotions have no promotion badge or condition note.

## Data flow

1. The simulator requests its menu through the local `/api/ordrz/menu` proxy.
2. When Ordrz is configured, that proxy requests the business products endpoint with `include=categories,tags,modifiers,promotions` and returns the product records to the simulator.
3. The simulator copies a product's `promotionOffers` array onto its catalog item. The product-card UI reads that array to render the badge, additional-offer count, and conditional note.

The card UI expects this promotion shape:

```ts
{
  id: string
  name: string
  label?: string
  type?: string
  isConditional?: boolean
  startAt?: string | null
  endAt?: string | null
}
```

`label` and `isConditional` are optional. If no label is supplied, the promotion name is used. The card does not derive a discount label from `type` or calculate a discount amount; those values must come from the product's attached `promotionOffers` data.

## Source files

- `app/api/ordrz/[...resource]/route.ts` — loads products with their promotions through the Ordrz proxy.
- `app/simulator/page.tsx` — maps product promotion data into simulator catalog items and renders the product-card UI.
- `lib/offline-simulator.ts` — defines the `ProductPromotion` data shape.
