import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculate, cents, legacyOfferToDiscount, percentOf, seedState } from '../lib/offline-simulator.ts'

const makeDiscount = (overrides = {}) => ({
  id: 'test-discount',
  businessId: 'test-business',
  name: 'Test discount',
  type: 'PERCENTAGE',
  scope: 'ITEM',
  value: 20,
  applicationModes: ['AUTOMATIC'],
  rules: {},
  taxTreatment: null,
  isActive: true,
  isStackable: true,
  priority: 1,
  startAt: null,
  endAt: null,
  maxUses: null,
  usesPerCustomer: null,
  ...overrides,
})

test('converts decimal input to integer cents', () => {
  assert.equal(cents('1,234.56'), 123456)
  assert.equal(cents('0.1'), 10)
})

test('imports the supplied restaurant menu into the local simulator catalog', () => {
  const state = seedState()
  assert.equal(state.items.length, 91)
  assert.deepEqual(state.discounts, [])
  assert.deepEqual(state.discountCodes, [])
  assert.ok(state.items.some(item => item.sku === '438673' && item.name === 'Beef Chilli Dry & Chips'))
  assert.ok(state.categories.includes('Chicken Wok Tossed Fries'))
})

test('maps legacy offer-builder discounts onto the imported cart catalog', () => {
  const state = seedState()
  const discount = legacyOfferToDiscount({
    id: 'legacy-bogo',
    name: 'Buy wok fries, get Coke',
    type: 'bogo',
    status: 'active',
    buyQuantity: 1,
    getQuantity: 1,
    getItemDiscount: 100,
    bogoItems: ['438673'],
    bogoRewardItems: ['431756'],
    limits: { maxPerTransaction: 1 },
    rules: {},
    schedule: {},
  }, state.items)
  assert.equal(discount?.type, 'BUY_X_GET_Y')
  assert.deepEqual(discount?.rules.buyItemIds, ['602de2b7-5ab8-47d8-b79e-6bfb85006942'])
  assert.deepEqual(discount?.rules.getItemIds, ['d2bc3a29-f222-4ad1-af7a-fc746a7cb55c'])
})

test('applies only the saved user-created BOGO offer to the order', () => {
  const state = seedState()
  const offer = legacyOfferToDiscount({
    id: 'created-bogo',
    name: 'Buy Beef, get second Beef free',
    type: 'bogo',
    status: 'active',
    buyQuantity: 1,
    getQuantity: 1,
    getItemDiscount: 100,
    bogoItems: ['438673'],
    bogoRewardItems: ['431734'],
    limits: { maxPerTransaction: 1 },
    rules: {},
    schedule: {},
  }, state.items)
  state.discounts = [offer]
  state.cart = [
    { id: 'buy', itemId: state.items.find(item => item.sku === '438673').id, qty: 1 },
    { id: 'reward', itemId: state.items.find(item => item.sku === '431734').id, qty: 1 },
  ]
  const result = calculate(state)
  assert.equal(result.applied.length, 1)
  assert.equal(result.applied[0].discount.name, 'Buy Beef, get second Beef free')
  assert.equal(result.discountTotal, 135000)
  assert.equal(result.total, 170720)
})

test('applies a fixed final price to a BOGO reward item', () => {
  const state = seedState()
  const buy = state.items[0]
  const reward = state.items[1]
  const offer = legacyOfferToDiscount({
    id: 'fixed-price-bogo',
    name: 'Buy one, get one for Rs 10',
    type: 'bogo',
    status: 'active',
    buyQuantity: 1,
    getQuantity: 1,
    bogoRewardMode: 'fixed_price',
    bogoRewardValue: 1000,
    bogoItems: [buy.sku],
    bogoRewardItems: [reward.sku],
    limits: { maxPerTransaction: 1 },
    rules: {},
    schedule: {},
  }, state.items)
  state.discounts = [offer]
  state.cart = [
    { id: 'buy', itemId: buy.id, qty: 1 },
    { id: 'reward', itemId: reward.id, qty: 1 },
  ]
  assert.equal(calculate(state).discountTotal, reward.price - 1000)
})

test('rounds percentage calculations to whole cents without float currency math', () => {
  assert.equal(percentOf(10001, 20), 2000)
  assert.equal(percentOf(100, 10), 10)
})

test('calculates a tax after discount and original price tax bases', () => {
  const state = seedState()
  state.cart = [{ id: 'line', itemId: state.items[0].id, qty: 1 }]
  state.discounts = [makeDiscount({ value: 20, rules: { itemIds: [state.items[0].id] } })]
  state.items[0].price = 10000
  state.items[0].taxRate = 10
  const after = calculate(state)
  assert.equal(after.discountTotal, 2000)
  assert.equal(after.lines[0].tax, 800)
  state.settings.taxTreatment = 'ORIGINAL_PRICE'
  assert.equal(calculate(state).lines[0].tax, 1000)
})

test('manual reward BOGO needs the reward in the cart and applies to cheapest reward', () => {
  const state = seedState()
  const bogo = makeDiscount({
    name: 'Buy item get reward',
    type: 'BUY_X_GET_Y',
    value: null,
    isStackable: false,
    rules: { buyItemIds: [state.items[0].id], getItemIds: [state.items.find(item => item.sku === '431756').id], buyQuantity: 1, getQuantity: 1, getBenefit: 'PERCENTAGE', getValue: 100, maxApplications: 1, rewardMode: 'MANUAL' },
  })
  state.discounts = [bogo]
  state.cart = [{ id: 'burger', itemId: state.items[0].id, qty: 1 }]
  assert.equal(calculate(state).discountTotal, 0)
  const reward = state.items.find(item => item.id === bogo.rules.getItemIds[0])
  state.cart.push({ id: 'reward', itemId: reward.id, qty: 1 })
  assert.equal(calculate(state).discountTotal, reward.price)
})

test('same-item BOGO reserves qualifying units before selecting free reward units', () => {
  const state = seedState()
  const bogo = makeDiscount({
    name: 'Same item BOGO',
    type: 'BUY_X_GET_Y',
    value: null,
    isStackable: false,
    rules: { buyItemIds: [state.items[0].id], getItemIds: [state.items[0].id], buyQuantity: 1, getQuantity: 1, getBenefit: 'PERCENTAGE', getValue: 100, maxApplications: 3 },
  })
  state.discounts = [bogo]
  state.cart = [{ id: 'burger', itemId: state.items[0].id, qty: 1 }]
  assert.equal(calculate(state).discountTotal, 0)
  state.cart[0].qty = 2
  assert.equal(calculate(state).discountTotal, state.items[0].price)
})

test('lower priority non-stackable discount blocks later promotions', () => {
  const state = seedState()
  state.cart = [{ id: 'burger', itemId: state.items[0].id, qty: 1 }]
  const itemDiscount = makeDiscount({ id: 'item-discount', value: 20, rules: { itemIds: [state.items[0].id] }, isStackable: false, priority: 1 })
  const orderDiscount = makeDiscount({ id: 'order-discount', name: 'WELCOME10', scope: 'ORDER', value: 10, applicationModes: ['CODE'], isStackable: false, priority: 2 })
  state.discounts = [itemDiscount, orderDiscount]
  state.discountCodes = [{ id: 'welcome-code', discountId: orderDiscount.id, code: 'WELCOME10', isActive: true, startAt: null, endAt: null, maxUses: null, usesPerCustomer: null }]
  state.couponCodes = ['WELCOME10']
  const result = calculate(state)
  assert.equal(result.applied.length, 1)
  assert.ok(result.reasons.some(r => r.includes('blocked')))
})

test('maximum discount cap is respected by both the ledger and line allocation', () => {
  const state = seedState()
  state.cart = [{ id: 'burger', itemId: state.items[0].id, qty: 1 }]
  state.discounts = [makeDiscount({ value: 50, rules: { maxDiscount: 5000 } })]
  const result = calculate(state)
  assert.equal(result.discountTotal, 5000)
  assert.equal(result.lines[0].discount, 5000)
})

test('delivery promotions do not apply to pickup orders', () => {
  const state = seedState()
  state.cart = [{ id: 'burger', itemId: state.items[0].id, qty: 1 }]
  state.discounts = [makeDiscount({ id: 'delivery-discount', name: 'Free delivery', type: 'FREE_DELIVERY', scope: 'DELIVERY', value: null, rules: { minSubtotal: 0 } })]
  assert.equal(calculate(state).deliveryDiscount, 0)
  state.orderType = 'DELIVERY'
  assert.equal(calculate(state).deliveryDiscount, state.settings.deliveryFee)
})

test('fixed amount, fixed price, quantity tier, and spend tier discounts calculate locally', () => {
  const state = seedState()
  state.items[0].price = 10000
  state.cart = [{ id: 'burger', itemId: state.items[0].id, qty: 5 }]
  const configured = (type, value, rules = {}) => makeDiscount({ type, scope: 'ITEM', value, rules, isStackable: true })
  state.discounts = [configured('FIXED_AMOUNT', 1000)]
  assert.equal(calculate(state).discountTotal, 5000)
  state.discounts = [configured('FIXED_PRICE', 8000)]
  assert.equal(calculate(state).discountTotal, 10000)
  state.discounts = [configured('QUANTITY_TIER', null, { tiers: [{ quantity: 2, percent: 5 }, { quantity: 5, percent: 10 }] })]
  assert.equal(calculate(state).discountTotal, 5000)
  state.discounts = [configured('SPEND_TIER', null, { tiers: [{ minimum: 10000, percent: 5 }, { minimum: 40000, amount: 6000 }] })]
  assert.equal(calculate(state).discountTotal, 6000)
})

test('combo promotion waits for required products and applies a complete set', () => {
  const state = seedState()
  const [burger, fries] = state.items
  state.discounts = [makeDiscount({ type: 'COMBO', scope: 'ITEM', value: null, rules: { requiredItems: [{ itemId: burger.id, quantity: 1 }, { itemId: fries.id, quantity: 1 }], bundlePrice: 100000, maxApplications: 2 } })]
  state.cart = [{ id: 'burger', itemId: burger.id, qty: 1 }]
  assert.equal(calculate(state).discountTotal, 0)
  state.cart.push({ id: 'fries', itemId: fries.id, qty: 1 })
  assert.equal(calculate(state).discountTotal, burger.price + fries.price - 100000)
})
