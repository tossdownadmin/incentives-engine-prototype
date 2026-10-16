import { ordrzApi, type OrdrzApiStatus } from '@/lib/ordrz-client'

export type SimulatorApiStatus = OrdrzApiStatus

export const simulatorApi = ordrzApi

export function responseList(value: any, keys: string[] = []) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.lines)) return value.lines
  if (Array.isArray(value?.cart?.lines)) return value.cart.lines
  for (const key of [...keys, 'items', 'products', 'discounts', 'coupons', 'orders', 'redemptions', 'locations', 'customers', 'results', 'records']) {
    if (Array.isArray(value?.[key])) return value[key]
  }
  if (value?.data && value.data !== value) return responseList(value.data, keys)
  return []
}
