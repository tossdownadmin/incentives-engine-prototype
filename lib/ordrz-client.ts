import type { MenuItem } from '@/lib/types'

export type OrdrzApiStatus = {
  businessId: string
  productsConfigured: boolean
  addItemConfigured: boolean
  itemsConfigured: boolean
  discountsConfigured: boolean
  couponsConfigured: boolean
  cartConfigured: boolean
  calculationConfigured: boolean
  checkoutConfigured: boolean
  ordersConfigured: boolean
  redemptionsConfigured: boolean
  locationsConfigured: boolean
  customersConfigured: boolean
}

const record = (value: unknown): Record<string, any> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null

const pickText = (value: Record<string, any>, keys: string[], fallback = '') => {
  for (const key of keys) if (value[key] !== undefined && value[key] !== null) return String(value[key])
  return fallback
}

const slugify = (value: string) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export function normalizeOrdrzProduct(value: unknown, index = 0): MenuItem | null {
  const item = record(value)
  if (!item) return null
  const id = pickText(item, ['id', '_id', 'productId', 'itemId'], `ordrz-${index}`)
  const name = pickText(item, ['name', 'title', 'productName', 'itemName'])
  if (!name) return null

  const majorPrice = Number(
    item.effectivePrice ?? item.effectiveBasePrice ?? item.basePrice ?? item.price ?? item.amount ?? item.unitPrice ?? 0,
  )
  const price = Number(item.priceCents ?? item.amountCents ?? Math.round(majorPrice * 100))
  const firstCategory = Array.isArray(item.categories) ? item.categories[0] : undefined
  const categoryValue = item.category ?? firstCategory
  const category = typeof categoryValue === 'object'
    ? pickText(categoryValue, ['name', 'title', 'label'], 'Other')
    : pickText(item, ['categoryName', 'category', 'categoryTitle'], 'Other')
  const available = item.isAvailable ?? item.available ?? item.active ?? item.isActive ?? item.status === 'ACTIVE'

  return {
    id,
    sku: pickText(item, ['sku', 'code', 'productCode', 'itemCode'], id).toUpperCase(),
    name,
    category,
    price,
    available: typeof available === 'boolean' ? available : true,
    image: pickText(item, ['imageUrl', 'image', 'photoUrl', 'thumbnailUrl', 'thumbnail']) || undefined,
  }
}

export async function ordrzApi<T = any>(
  resource: string,
  method = 'GET',
  body?: unknown,
  idempotencyKey?: string,
  cartId?: string,
): Promise<T> {
  const normalizedResource = resource.replace(/^\/+/, '')
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  if (cartId) headers['X-Cart-Id'] = cartId

  const response = await fetch(`/api/ordrz/${normalizedResource}`, {
    method,
    headers,
    cache: 'no-store',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const details = Array.isArray(data?.details)
      ? data.details.map((detail: any) => detail?.message || detail?.field).filter(Boolean).join(', ')
      : ''
    throw new Error(details || data?.message || data?.error || `${method} ${normalizedResource} failed (${response.status})`)
  }
  return data as T
}

export async function fetchOrdrzMenu() {
  const data = await ordrzApi<any>('menu')
  const rawItems: unknown[] = Array.isArray(data?.items) ? data.items : []
  const items: MenuItem[] = rawItems
    .map((item, index) => normalizeOrdrzProduct(item, index))
    .filter((item): item is MenuItem => item !== null)
  const apiCategories = Array.isArray(data?.categories)
    ? data.categories.map((category: any) => typeof category === 'string' ? category : category?.name).filter(Boolean)
    : []
  const categories = new Set([...apiCategories, ...items.map(item => item.category).filter(Boolean)])
  return { items, categories: [...categories].sort() }
}

async function categoryIdFor(name: string) {
  const data = await ordrzApi<any>('categories')
  const categories = data?.data?.categories || data?.data?.items || data?.categories || []
  return categories.find((category: any) => category?.name === name)?.id as string | undefined
}

async function menuItemPayload(item: Omit<MenuItem, 'id'> | MenuItem) {
  const categoryId = item.category ? await categoryIdFor(item.category).catch(() => undefined) : undefined
  return {
    sku: item.sku,
    slug: `${slugify(item.name)}-${slugify(item.sku)}`,
    name: item.name,
    basePrice: item.price / 100,
    status: item.available ? 'ACTIVE' : 'INACTIVE',
    isAvailable: item.available,
    imageUrl: item.image || null,
    ...(categoryId ? { categoryIds: [categoryId] } : {}),
  }
}

export async function createOrdrzItem(input: Omit<MenuItem, 'id'>) {
  const result = await ordrzApi<any>('items', 'POST', await menuItemPayload(input))
  return normalizeOrdrzProduct(result?.data?.item ?? result?.data ?? result?.item ?? result, 0)
    ?? { ...input, id: `ordrz-${Date.now()}` }
}

export async function updateOrdrzItem(item: MenuItem) {
  const result = await ordrzApi<any>(`items/${encodeURIComponent(item.id)}`, 'PATCH', await menuItemPayload(item))
  return normalizeOrdrzProduct(result?.data?.item ?? result?.data ?? result?.item ?? result, 0) ?? item
}
