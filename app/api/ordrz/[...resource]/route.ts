import { NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ resource: string[] }> }

const API_BASE = process.env.ORDRZ_API_BASE || 'https://apiv2.ordrz.com'
const BUSINESS_ID = process.env.ORDRZ_BUSINESS_ID || ''
const API_TOKEN = process.env.ORDRZ_API_TOKEN || ''

const discountFields = new Set([
  'name', 'type', 'scope', 'value', 'rules', 'applicationModes', 'taxTreatment',
  'isActive', 'isStackable', 'priority', 'startAt', 'endAt', 'maxUses', 'usesPerCustomer',
])

function configured() {
  if (!BUSINESS_ID) throw new Error('ORDRZ_BUSINESS_ID is not configured')
}

function filterObject(value: unknown, allowed: Set<string>) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.has(key)))
}

const slugify = (value: string) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

async function normalizeMenuItemBody(body: unknown, request: NextRequest) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body
  const source = body as Record<string, any>
  if (source.basePrice !== undefined || source.item) return source
  let categoryIds: string[] | undefined
  if (source.category) {
    const response = await callOrdrz(
      `/api/v1/business/${BUSINESS_ID}/categories`,
      request,
      { method: 'GET', defaults: { pageSize: '100' } },
    )
    const payload = await response.json().catch(() => ({}))
    const categories = payload?.data?.categories || payload?.data?.items || []
    const category = categories.find((entry: any) => entry?.name === source.category)
    if (category?.id) categoryIds = [category.id]
  }
  const sku = String(source.sku || source.productCode || source.name || '').toUpperCase()
  return {
    sku,
    slug: `${slugify(String(source.name || 'item'))}-${slugify(sku)}`,
    name: source.name,
    basePrice: Number(source.price || 0) / 100,
    status: source.active === false || source.available === false ? 'INACTIVE' : 'ACTIVE',
    isAvailable: source.active !== false && source.available !== false,
    imageUrl: source.image || source.imageUrl || null,
    ...(categoryIds ? { categoryIds } : {}),
  }
}

function withQuery(path: string, request: NextRequest, defaults?: Record<string, string>) {
  const url = new URL(path, `${API_BASE}/`)
  for (const [key, value] of Object.entries(defaults || {})) {
    if (!request.nextUrl.searchParams.has(key)) url.searchParams.set(key, value)
  }
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value))
  return url
}

async function callOrdrz(
  path: string,
  request: NextRequest,
  options: { method?: string; body?: unknown; auth?: boolean; defaults?: Record<string, string> } = {},
) {
  const headers = new Headers({ Accept: 'application/json' })
  if (options.auth !== false) {
    if (!API_TOKEN) throw new Error('ORDRZ_API_TOKEN is not configured')
    headers.set('Authorization', `Bearer ${API_TOKEN}`)
  }
  const cartId = request.headers.get('x-cart-id')
  const idempotencyKey = request.headers.get('idempotency-key')
  if (cartId) headers.set('X-Cart-Id', cartId)
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')

  return fetch(withQuery(path, request, options.defaults), {
    method: options.method || request.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  })
}

async function readBody(request: NextRequest) {
  if (request.method === 'GET' || request.method === 'DELETE') return undefined
  return request.json().catch(() => undefined)
}

async function responseFrom(upstream: Response) {
  const text = await upstream.text()
  const response = new NextResponse(text || null, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
  })
  const cartId = upstream.headers.get('x-cart-id')
  if (cartId) response.headers.set('X-Cart-Id', cartId)
  return response
}

async function handler(request: NextRequest, context: RouteContext) {
  try {
    const { resource } = await context.params
    const [name, ...rest] = resource
    configured()

    if (name === 'status') {
      const privateReady = Boolean(API_TOKEN && BUSINESS_ID)
      return NextResponse.json({
        businessId: BUSINESS_ID,
        productsConfigured: true,
        addItemConfigured: privateReady,
        itemsConfigured: privateReady,
        discountsConfigured: privateReady,
        couponsConfigured: privateReady,
        cartConfigured: true,
        calculationConfigured: true,
        checkoutConfigured: true,
        ordersConfigured: privateReady,
        redemptionsConfigured: false,
        locationsConfigured: privateReady,
        customersConfigured: privateReady,
      })
    }

    if (name === 'menu') {
      const productsResponse = await callOrdrz(
        `/api/v1/business/${BUSINESS_ID}/products`,
        request,
        { method: 'GET', auth: false, defaults: { pagination: 'false', include: 'categories,tags,modifiers,promotions' } },
      )
      const payload = await productsResponse.json().catch(() => ({}))
      if (!productsResponse.ok) return NextResponse.json(payload, { status: productsResponse.status })
      return NextResponse.json({
        items: payload?.data?.items || [],
        categories: payload?.data?.categories || [],
      })
    }

    if (name === 'coupons' && request.method === 'GET') {
      const discountsResponse = await callOrdrz(
        `/api/v1/business/${BUSINESS_ID}/discounts`,
        request,
        { method: 'GET', defaults: { pageSize: '100' } },
      )
      const payload = await discountsResponse.json().catch(() => ({}))
      if (!discountsResponse.ok) return NextResponse.json(payload, { status: discountsResponse.status })
      const discounts = payload?.data?.items || []
      const coupons = discounts.flatMap((discount: any) =>
        (discount.codes || []).map((code: any) => ({ ...code, discountId: discount.id })),
      )
      return NextResponse.json({ success: true, data: { coupons } })
    }

    let body = await readBody(request)
    let path: string
    let auth = true
    let defaults: Record<string, string> | undefined

    switch (name) {
      case 'products':
        path = `/api/v1/business/${BUSINESS_ID}/products${rest.length ? `/${rest.join('/')}` : ''}`
        auth = false
        defaults = { pagination: 'false' }
        break
      case 'categories':
        path = `/api/v1/business/${BUSINESS_ID}/categories${rest.length ? `/${rest.join('/')}` : ''}`
        defaults = { pageSize: '100' }
        break
      case 'items':
        path = `/api/v1/business/${BUSINESS_ID}/menu/items${rest.length ? `/${rest.join('/')}` : ''}`
        if (body !== undefined) body = await normalizeMenuItemBody(body, request)
        break
      case 'discounts':
        path = `/api/v1/business/${BUSINESS_ID}/discounts${rest.length ? `/${rest.join('/')}` : ''}`
        defaults = request.method === 'GET' ? { pageSize: '100' } : undefined
        if (body !== undefined && !rest.includes('codes')) body = filterObject(body, discountFields)
        break
      case 'coupons': {
        const source = body && typeof body === 'object' ? body as Record<string, unknown> : {}
        const discountId = String(rest[0] || source.discountId || '')
        const codeId = String(rest[1] || '')
        if (!discountId) throw new Error('A discountId is required for coupon operations')
        path = `/api/v1/business/${BUSINESS_ID}/discounts/${encodeURIComponent(discountId)}/codes${codeId ? `/${encodeURIComponent(codeId)}` : ''}`
        body = filterObject(source, new Set(['code', 'isActive', 'startAt', 'endAt', 'maxUses', 'usesPerCustomer']))
        break
      }
      case 'locations':
        path = `/api/v1/business/${BUSINESS_ID}/locations${rest.length ? `/${rest.join('/')}` : ''}`
        defaults = request.method === 'GET' ? { pageSize: '100' } : undefined
        break
      case 'customers':
        path = `/api/v1/business/${BUSINESS_ID}/customers${rest.length ? `/${rest.join('/')}` : ''}`
        defaults = request.method === 'GET' ? { pageSize: '100' } : undefined
        break
      case 'orders':
        path = `/api/v1/business/${BUSINESS_ID}/orders${rest.length ? `/${rest.join('/')}` : ''}`
        defaults = request.method === 'GET' ? { pageSize: '100' } : undefined
        break
      case 'taxes':
        path = `/api/v1/business/${BUSINESS_ID}/taxes${rest.length ? `/${rest.join('/')}` : ''}`
        break
      case 'calculate':
        path = '/api/v1/public/cart/calculate'
        auth = false
        break
      case 'business-calculate':
        path = `/api/v1/business/${BUSINESS_ID}/pricing/cart/calculate`
        break
      case 'cart':
        path = `/api/v1/public/cart${rest.length ? `/${rest.join('/')}` : ''}`
        auth = false
        break
      case 'checkout':
        path = `/api/v1/public/checkout/sessions${rest.length ? `/${rest.join('/')}` : ''}`
        auth = false
        break
      default:
        return NextResponse.json({ message: `Unknown Ordrz resource: ${name}` }, { status: 404 })
    }

    return responseFrom(await callOrdrz(path, request, { body, auth, defaults }))
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Ordrz proxy request failed' },
      { status: 500 },
    )
  }
}

export const dynamic = 'force-dynamic'
export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
