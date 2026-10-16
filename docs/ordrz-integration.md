# Ordrz API integration

The browser calls the local `/api/ordrz/*` route. That server route forwards requests to `https://apiv2.ordrz.com` and adds the private bearer token. The token is never included in the client bundle.

Copy `.env.example` to `.env.local` and configure:

```env
ORDRZ_API_BASE=https://apiv2.ordrz.com
ORDRZ_BUSINESS_ID=your-business-uuid
ORDRZ_API_TOKEN=your-private-jwt
```

The integration follows the published OpenAPI contract at `https://apiv2.ordrz.com/docs/openapi.json`:

- catalog: `/api/v1/business/{businessId}/products`
- menu item CRUD: `/api/v1/business/{businessId}/menu/items`
- fetch promotions: `GET /api/ordrz/discounts` → `GET /api/v1/business/{businessId}/discounts`
- create promotions: `POST /api/ordrz/discounts` → `POST /api/v1/business/{businessId}/discounts`
- update promotions: `PATCH /api/ordrz/discounts/{discountId}`
- archive promotions: `DELETE /api/ordrz/discounts/{discountId}` (Ordrz keeps the returned record inactive)
- promotion codes: `/api/v1/business/{businessId}/discounts/{discountId}/codes`
- public pricing: `/api/v1/public/cart/calculate`
- manager pricing: `/api/v1/business/{businessId}/pricing/cart/calculate`
- checkout: `/api/v1/public/checkout/sessions`
- orders, locations, customers, taxes, and delivery zones: authenticated business routes

Public checkout is asynchronous. The simulator submits a COD checkout with an idempotency key, polls its checkout session briefly, and refreshes the business order list. The API does not publish a standalone redemption-ledger endpoint, so that screen remains an offline-only simulator feature.
