export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FIXED_PRICE' | 'BUY_X_GET_Y' | 'COMBO' | 'QUANTITY_TIER' | 'SPEND_TIER' | 'FREE_ITEM' | 'FREE_DELIVERY' | 'REDUCED_DELIVERY' | 'OPEN_PERCENTAGE' | 'OPEN_AMOUNT'
export type DiscountMode = 'AUTOMATIC' | 'CODE' | 'MANUAL'
export type TaxTreatment = 'DISCOUNTED_PRICE' | 'ORIGINAL_PRICE'
export type Discount = { id:string; businessId:string; name:string; type:DiscountType; scope:'ITEM'|'ORDER'|'DELIVERY'; value:number|null; applicationModes:DiscountMode[]; rules:Record<string, any>; taxTreatment:TaxTreatment|null; isActive:boolean; isStackable:boolean; priority:number; startAt:string|null; endAt:string|null; maxUses:number|null; usesPerCustomer:number|null }
export type Coupon = { id:string; discountId:string; code:string; isActive:boolean; startAt:string|null; endAt:string|null; maxUses:number|null; usesPerCustomer:number|null }
export type Redemption = { id:string; discountId:string; discountCodeId:string|null; customerId:string|null; cartId:string|null; orderId:string|null; amount:number; status:'RESERVED'|'APPLIED'|'RELEASED'; createdAt:string; appliedAt:string|null; releasedAt:string|null }
export type ProductPromotion = { id:string; name:string; type?:string; label?:string; isConditional?:boolean; startAt?:string|null; endAt?:string|null }
export type CatalogItem = { id:string; sku?:string; name:string; category:string; price:number; active:boolean; locations:string[]; stock:number; taxRate:number|null; taxInclusive:boolean; image?:string; promotionOffers?:ProductPromotion[] }
export type Customer = { id:string; name:string; tags:string[]; orders:number; phone?:string; email?:string }
export type CartLine = { id:string; itemId:string; qty:number; autoRewardDiscountId?:string }
export type SimulatorState = { businesses:{id:string;name:string}[]; locations:{id:string;name:string;taxRate:number}[]; categories:string[]; items:CatalogItem[]; customers:Customer[]; discounts:Discount[]; discountCodes:Coupon[]; discountRedemptions:Redemption[]; orders:any[]; settings:{currency:string;taxRate:number;taxTreatment:TaxTreatment;timezone:string;role:string;simulatedAt:string;deliveryFee:number;deliveryTaxRate:number}; cart:CartLine[]; selectedLocation:string; selectedCustomer:string; orderType:'PICKUP'|'DELIVERY'; couponCodes:string[] }

const uid = () => crypto.randomUUID()
import { IMPORTED_MENU_ITEMS } from './imported-menu.ts'
export const money = (cents:number, currency='PKR') => new Intl.NumberFormat('en-PK',{style:'currency',currency,maximumFractionDigits:2}).format(cents/100)
export const cents = (value:string|number) => { const s=String(value).trim(); if(!s) return 0; const neg=s.startsWith('-'); const [whole='',fraction='']=s.replace(/[^\d.]/g,'').split('.'); const result=Number(whole||0)*100+Number((fraction+'00').slice(0,2)); return neg?-result:result }
export const percentOf = (amount:number, percent:number) => Number((BigInt(Math.max(0,Math.round(amount)))*BigInt(Math.round(percent*100))+BigInt(5000))/BigInt(10000))
const id = (n:number) => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`
export function seedState():SimulatorState {
 const locations=[{id:id(11),name:'Main Branch',taxRate:10},{id:id(12),name:'Gulberg Branch',taxRate:10},{id:id(13),name:'DHA Branch',taxRate:15}]
 const items=IMPORTED_MENU_ITEMS.map(item=>({...item,active:true,locations:locations.map(l=>l.id),stock:35,taxRate:null,taxInclusive:false}))
 const customers:Customer[]=[{id:id(31),name:'Guest customer',tags:['guest'],orders:0},{id:id(32),name:'First-time customer',tags:['new'],orders:0},{id:id(33),name:'Returning customer',tags:['returning'],orders:4},{id:id(34),name:'VIP customer',tags:['vip'],orders:12},{id:id(35),name:'Customer with VIP tag',tags:['vip','tagged'],orders:7}]
 return {businesses:[{id:id(1),name:'Test Restaurant'}],locations,categories:Array.from(new Set(items.map(item=>item.category))),items,customers,discounts:[],discountCodes:[],discountRedemptions:[],orders:[],settings:{currency:'PKR',taxRate:10,taxTreatment:'DISCOUNTED_PRICE',timezone:'Asia/Karachi',role:'MANAGER',simulatedAt:new Date().toISOString(),deliveryFee:15000,deliveryTaxRate:10},cart:[],selectedLocation:locations[0].id,selectedCustomer:customers[0].id,orderType:'PICKUP',couponCodes:[]}
}

export function calculate(state:SimulatorState, openValue=0, manualDiscountId?:string) {
 const lines=state.cart.map(line=>({line,item:state.items.find(i=>i.id===line.itemId)})).filter(x=>x.item)
 const subtotal=lines.reduce((sum,x)=>sum+x.item!.price*x.line.qty,0)
 const reasons:string[]=[]; const eligible:string[]=[]; const applied:{discount:Discount;amount:number;lineAmounts:Record<string,number>;reason:string}[]=[]
 let remaining=lines.map(x=>({id:x.line.id,item:x.item!,qty:x.line.qty,base:x.item!.price*x.line.qty,discount:0}))
 const location=state.locations.find(x=>x.id===state.selectedLocation); const customer=state.customers.find(x=>x.id===state.selectedCustomer)
 const now=new Date(state.settings.simulatedAt)
 const coupons=state.couponCodes.map(code=>state.discountCodes.find(c=>c.code===code.trim().toUpperCase()))
 const candidates=state.discounts.filter(d=>d.isActive).sort((a,b)=>a.priority-b.priority)
 let blocked=false
 for(const d of candidates){
   const mode=d.applicationModes.includes('AUTOMATIC')?'AUTOMATIC':d.applicationModes.includes('CODE')?'CODE':d.applicationModes[0]
   if(mode==='CODE'&&!coupons.some(c=>c?.discountId===d.id)){reasons.push(`${d.name}: coupon code not applied.`);continue}
   if(mode==='MANUAL'&&d.id!==manualDiscountId) continue
   if((d.type==='OPEN_PERCENTAGE'||d.type==='OPEN_AMOUNT')&&d.id!==manualDiscountId){reasons.push(`${d.name}: a manager must enter and approve the open discount value.`);continue}
   if(blocked){reasons.push(`${d.name}: blocked by a higher-priority non-stackable discount.`);continue}
   if(d.startAt&&now<new Date(d.startAt)||d.endAt&&now>new Date(d.endAt)){reasons.push(`${d.name}: outside its active date window.`);continue}
   const r=d.rules||{}; const uses=state.discountRedemptions.filter(x=>x.discountId===d.id&&x.status!=='RELEASED').length
   if(d.maxUses!=null&&uses>=d.maxUses){reasons.push(`${d.name}: total usage limit reached.`);continue}
   const customerUses=state.discountRedemptions.filter(x=>x.discountId===d.id&&x.customerId===state.selectedCustomer&&x.status!=='RELEASED').length
   if(d.usesPerCustomer!=null&&customerUses>=d.usesPerCustomer){reasons.push(`${d.name}: this customer has reached their usage limit.`);continue}
   const coupon=state.discountCodes.find(c=>c.discountId===d.id&&state.couponCodes.includes(c.code))
   if(coupon){const couponUses=state.discountRedemptions.filter(x=>x.discountCodeId===coupon.id&&x.status!=='RELEASED').length;const couponCustomerUses=state.discountRedemptions.filter(x=>x.discountCodeId===coupon.id&&x.customerId===state.selectedCustomer&&x.status!=='RELEASED').length;if(coupon.maxUses!=null&&couponUses>=coupon.maxUses){reasons.push(`${coupon.code}: total coupon use limit reached.`);continue}if(coupon.usesPerCustomer!=null&&couponCustomerUses>=coupon.usesPerCustomer){reasons.push(`${coupon.code}: customer coupon limit reached.`);continue}if(!coupon.isActive){reasons.push(`${coupon.code}: coupon is inactive.`);continue}if(coupon.startAt&&now<new Date(coupon.startAt)||coupon.endAt&&now>new Date(coupon.endAt)){reasons.push(`${coupon.code}: outside its active date window.`);continue}}
   if(r.schedule?.windows?.length){const parts=new Intl.DateTimeFormat('en-US',{timeZone:r.schedule.timezone||state.settings.timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);const wd=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.find(p=>p.type==='weekday')?.value||'Sun');const hh=Number(parts.find(p=>p.type==='hour')?.value||0),mm=Number(parts.find(p=>p.type==='minute')?.value||0),minute=hh*60+mm;const time=(v:string)=>{const [h,m]=v.split(':').map(Number);return h*60+m};const inSchedule=r.schedule.windows.some((w:any)=>{const a=time(w.start),b=time(w.end);if(a<=b)return w.days.includes(wd)&&minute>=a&&minute<=b;return w.days.includes(wd)&&minute>=a||w.days.includes((wd+6)%7)&&minute<=b});if(!inSchedule){reasons.push(`${d.name}: outside its weekly schedule.`);continue}}
   if(r.locationIds?.length&&!r.locationIds.includes(state.selectedLocation)){reasons.push(`${d.name}: unavailable at this location.`);continue}
   if(r.orderTypes?.length&&!r.orderTypes.includes(state.orderType)){reasons.push(`${d.name}: unavailable for ${state.orderType.toLowerCase()}.`);continue}
   if(r.customerIds?.length&&!r.customerIds.includes(state.selectedCustomer)){reasons.push(`${d.name}: customer is not eligible.`);continue}
   if(r.customerTags?.length&&!r.customerTags.some((tag:string)=>customer?.tags.includes(tag))){reasons.push(`${d.name}: customer tag requirement not met.`);continue}
   if(r.firstOrderOnly&&customer?.orders){reasons.push(`${d.name}: first-order customers only.`);continue}
   if(r.minSubtotal!=null&&subtotal<r.minSubtotal){reasons.push(`${d.name}: minimum spend is ${money(r.minSubtotal)}.`);continue}
   if(r.maxSubtotal!=null&&subtotal>r.maxSubtotal){reasons.push(`${d.name}: subtotal exceeds maximum.`);continue}
   const cartQuantity=remaining.reduce((s,x)=>s+x.qty,0)
   if(r.minQuantity!=null&&cartQuantity<r.minQuantity){reasons.push(`${d.name}: minimum quantity is ${r.minQuantity}.`);continue}
   if(r.maxQuantity!=null&&cartQuantity>r.maxQuantity){reasons.push(`${d.name}: cart quantity exceeds ${r.maxQuantity}.`);continue}
   let baseAmount=0; let lineAmounts:Record<string,number>={}; let reason='Promotion eligible.'
   const target=remaining.filter(x=>{const ok=(!r.itemIds?.length||r.itemIds.includes(x.item.id))&&(!r.categoryIds?.length||r.categoryIds.includes(x.item.category))&&!r.excludedItemIds?.includes(x.item.id)&&!r.excludedCategoryIds?.includes(x.item.category);return ok})
   if(['PERCENTAGE','OPEN_PERCENTAGE'].includes(d.type)){
    const pct=d.type==='OPEN_PERCENTAGE'?openValue:Number(d.value||0); if(pct<0||pct>100){reasons.push(`${d.name}: percentage must be between 0 and 100.`);continue}
    const base=d.scope==='ORDER'?remaining.reduce((s,x)=>s+x.base-x.discount,0):target.reduce((s,x)=>s+x.base-x.discount,0)
    baseAmount=percentOf(base,pct); reason=`${pct}% ${d.scope==='ORDER'?'order':'eligible item'} discount.`
    const alloc=d.scope==='ORDER'?remaining:target; const allocBase=alloc.reduce((s,x)=>s+x.base-x.discount,0); let left=baseAmount
    alloc.forEach((x,i)=>{const b=x.base-x.discount;const a=i===alloc.length-1?left:allocBase?Math.floor(baseAmount*b/allocBase):0;lineAmounts[x.id]=a;left-=a})
   } else if(['FIXED_AMOUNT','OPEN_AMOUNT'].includes(d.type)){
    const wanted=Math.max(0,d.type==='OPEN_AMOUNT'?openValue:Number(d.value||0))
    if(d.scope==='ITEM'){for(const x of target){const a=Math.min(x.base-x.discount,wanted*x.qty);lineAmounts[x.id]=a;baseAmount+=a}}
    else {baseAmount=Math.min(wanted,remaining.reduce((s,x)=>s+x.base-x.discount,0));const alloc=remaining;const allocBase=alloc.reduce((s,x)=>s+x.base-x.discount,0);let left=baseAmount;alloc.forEach((x,i)=>{const b=x.base-x.discount;const a=i===alloc.length-1?left:allocBase?Math.floor(baseAmount*b/allocBase):0;lineAmounts[x.id]=a;left-=a})}
    reason=d.scope==='ITEM'?'Fixed amount applied per eligible item.':'Order amount allocated proportionally across eligible lines.'
   } else if(d.type==='FIXED_PRICE'){
    target.forEach(x=>{const discount=Math.max(0,(x.item.price-Number(d.value||0))*x.qty-x.discount);lineAmounts[x.id]=discount;baseAmount+=discount});reason='Eligible items repriced to the configured final price.'
   } else if(d.type==='BUY_X_GET_Y'||d.type==='FREE_ITEM'){
    const buy=Number(r.buyQuantity||1), get=Number(r.getQuantity||1);const buyLines=remaining.filter(x=>(!r.buyItemIds?.length||r.buyItemIds.includes(x.item.id))&&(!r.buyCategoryIds?.length||r.buyCategoryIds.includes(x.item.category)));const buyers=buyLines.reduce((s,x)=>s+x.qty,0);let apps=Math.min(Math.floor(buyers/buy),Number(r.maxApplications||99));
    const rewardMatches=(x:typeof remaining[number])=>(!r.getItemIds?.length||r.getItemIds.includes(x.item.id))&&(!r.getCategoryIds?.length||r.getCategoryIds.includes(x.item.category))&&!r.excludedRewardItemIds?.includes(x.item.id)
    let reserved=new Map<string,number>();let rewards:{id:string;item:CatalogItem;qty:number;base:number;discount:number;rewardQty:number}[]=[]
    while(apps>0){reserved=new Map<string,number>();let buyUnits=apps*buy;for(const x of buyLines){const used=Math.min(x.qty,buyUnits);reserved.set(x.id,used);buyUnits-=used;if(!buyUnits)break}rewards=remaining.filter(rewardMatches).map(x=>({...x,rewardQty:Math.max(0,x.qty-(reserved.get(x.id)||0))})).filter(x=>x.rewardQty>0).sort((a,b)=>a.item.price-b.item.price);if(rewards.reduce((sum,x)=>sum+x.rewardQty,0)>=apps*get)break;apps--}
    let count=apps*get;for(const x of rewards){if(count<=0)break;const q=Math.min(x.rewardQty,count);const pct=d.type==='FREE_ITEM'?100:Number(r.getValue??100);const benefit=r.getBenefit||'PERCENTAGE';const unit=benefit==='FIXED_AMOUNT'?Math.min(x.item.price,Number(r.getValue||0)):benefit==='FIXED_PRICE'?Math.max(0,x.item.price-Number(r.getValue||0)):percentOf(x.item.price,pct);lineAmounts[x.id]=(lineAmounts[x.id]||0)+unit*q;baseAmount+=unit*q;count-=q}
    if(!baseAmount){reasons.push(`${d.name}: add the qualifying reward item to the cart to complete this offer.`);continue}reason=`${buyers} qualifying buy item(s); reward discount applied to the lowest-priced eligible reward.`
   } else if(d.type==='QUANTITY_TIER'){
    const qty=target.reduce((s,x)=>s+x.qty,0);const tier=[...(r.tiers||[])].sort((a:any,b:any)=>b.quantity-a.quantity).find((t:any)=>qty>=t.quantity);if(!tier){reasons.push(`${d.name}: quantity tier not reached.`);continue}baseAmount=percentOf(target.reduce((s,x)=>s+x.base-x.discount,0),tier.percent);target.forEach(x=>lineAmounts[x.id]=percentOf(x.base-x.discount,tier.percent));reason=`Quantity tier ${tier.quantity}+ reached (${tier.percent}% off).`
   } else if(d.type==='SPEND_TIER'){
    const base=subtotal;const tier=[...(r.tiers||[])].sort((a:any,b:any)=>b.minimum-a.minimum).find((t:any)=>base>=t.minimum);if(!tier){reasons.push(`${d.name}: spend tier not reached.`);continue}baseAmount=tier.amount!=null?Math.min(tier.amount,base):percentOf(base,tier.percent||0);remaining.forEach(x=>lineAmounts[x.id]=Math.floor(baseAmount*(x.base-x.discount)/Math.max(1,base)));reason='Highest qualifying spend tier applied.'
   } else if(d.type==='COMBO'){
    const req=r.requiredItems||[];const sets=req.length?Math.min(...req.map((q:any)=>Math.floor((remaining.find(x=>x.item.id===q.itemId)?.qty||0)/q.quantity))):0;const apps=Math.min(sets,Number(r.maxApplications||99));baseAmount=Math.max(0,apps*(req.reduce((s:number,q:any)=>s+(remaining.find(x=>x.item.id===q.itemId)?.item.price||0)*q.quantity,0)-Number(r.bundlePrice||0)));if(!baseAmount){reasons.push(`${d.name}: required combo items are missing.`);continue}remaining.forEach(x=>{if(req.some((q:any)=>q.itemId===x.item.id))lineAmounts[x.id]=Math.floor(baseAmount/req.length)});reason=`${apps} complete combo set(s) repriced to ${money(r.bundlePrice||0)} each.`
   } else if(d.type==='FREE_DELIVERY'||d.type==='REDUCED_DELIVERY'){
    if(state.orderType!=='DELIVERY'){reasons.push(`${d.name}: delivery order required.`);continue}if(r.minSubtotal&&subtotal<r.minSubtotal){reasons.push(`${d.name}: minimum order is ${money(r.minSubtotal)}.`);continue}
    const deliveryItemIds=(r.itemIds||[]).map(String),deliveryCategoryIds=(r.categoryIds||[]).map(String)
    const hasDeliveryTarget=deliveryItemIds.length>0||deliveryCategoryIds.length>0
    const hasMatchingDeliveryItem=remaining.some(x=>(!deliveryItemIds.length||deliveryItemIds.includes(String(x.item.id)))&&(!deliveryCategoryIds.length||deliveryCategoryIds.includes(String(x.item.category))))
    if(hasDeliveryTarget&&!hasMatchingDeliveryItem){reasons.push(`${d.name}: add an eligible item or category to qualify for free delivery.`);continue}
    baseAmount=d.type==='FREE_DELIVERY'?state.settings.deliveryFee:Math.max(0,state.settings.deliveryFee-Number(r.deliveryPrice||r.value||0));baseAmount=Math.min(baseAmount,Number(r.maxDiscount||baseAmount));reason=hasDeliveryTarget?'Delivery charge waived for an eligible order.':'Delivery charge discount.'
   } else continue
   if(r.maxDiscount!=null&&baseAmount>r.maxDiscount){const allocated=Object.values(lineAmounts).reduce((sum,n)=>sum+n,0);if(allocated>r.maxDiscount){let left=r.maxDiscount;const entries=Object.entries(lineAmounts);entries.forEach(([lineId,amount],i)=>{const scaled=i===entries.length-1?left:Math.floor(amount*r.maxDiscount/allocated);lineAmounts[lineId]=scaled;left-=scaled})}baseAmount=Math.min(baseAmount,r.maxDiscount)}
   const actualLines:Record<string,number>={};let actualAmount=0
   for(const x of remaining){const wanted=lineAmounts[x.id]||0;const actual=Math.min(Math.max(0,x.base-x.discount),wanted);if(actual){x.discount+=actual;actualLines[x.id]=actual;actualAmount+=actual}}
   if(d.scope==='DELIVERY')actualAmount=baseAmount
   if(!actualAmount){reasons.push(`${d.name}: no eligible amount remained after higher-priority discounts.`);continue}
   applied.push({discount:d,amount:actualAmount,lineAmounts:actualLines,reason});eligible.push(d.id);if(!d.isStackable)blocked=true
 }
 const discountTotal=applied.reduce((s,x)=>s+x.amount,0)
 const lineResults=remaining.map(x=>{const discount=Math.min(x.base,x.discount);const treatment=applied.find(a=>a.lineAmounts[x.id]>0&&a.discount.taxTreatment)?.discount.taxTreatment||state.settings.taxTreatment;const taxRate=x.item.taxRate??location?.taxRate??state.settings.taxRate;const taxable=x.item.taxInclusive?x.base-discount:x.base-(treatment==='DISCOUNTED_PRICE'?discount:0);const tax=x.item.taxInclusive?Math.round(taxable*taxRate/(100+taxRate)):percentOf(taxable,taxRate);return {id:x.id,name:x.item.name,qty:x.qty,unitPrice:x.item.price,original:x.base,discount,taxable,tax,taxInclusive:x.item.taxInclusive,total:x.base-discount+(x.item.taxInclusive?0:tax)}})
 const deliveryDiscount=Math.min(state.settings.deliveryFee,applied.filter(x=>x.discount.type==='FREE_DELIVERY'||x.discount.type==='REDUCED_DELIVERY').reduce((s,x)=>s+x.amount,0));const deliveryTax=state.orderType==='DELIVERY'?percentOf(state.settings.deliveryFee-deliveryDiscount,state.settings.deliveryTaxRate):0
 const taxTotal=lineResults.reduce((s,x)=>s+x.tax,0)+deliveryTax;const total=lineResults.reduce((s,x)=>s+x.total,0)+(state.orderType==='DELIVERY'?state.settings.deliveryFee-deliveryDiscount+deliveryTax:0)
 for(const code of state.couponCodes){const exists=state.discountCodes.some(c=>c.code===code.trim().toUpperCase()&&c.isActive);if(!exists)reasons.push(`Invalid or inactive coupon code: ${code.trim().toUpperCase()}.`)}
 return {subtotal,discountTotal,deliveryDiscount,deliveryTax,taxTotal,total,lines:lineResults,applied,reasons,eligible,stacking:reasons.filter(x=>x.includes('blocked'))}
}

export const scenarioNames=['No discount','20% item discount','10% order discount','Fixed amount','Fixed price','Same-item BOGO','Different-item BOGO','Buy any get any','Category BOGO','BOGO 50% off','Combo','Quantity tiers','Spend tiers','Free item','Free delivery','Reduced delivery','Coupon success','Coupon invalid','Coupon expired','Coupon usage limit','Customer usage limit','First-order discount','Location restriction','Pickup-only discount','Delivery-only discount','Minimum subtotal','Maximum discount cap','Stackable discounts','Non-stackable discounts','Monday midnight to 5 AM','Overnight schedule','Tax after discount','Tax before discount','Manual percentage','Manual fixed amount','Checkout reservation','Payment failure release','Direct order applied redemption','Duplicate checkout','Changed cart retry']

export function legacyOfferToDiscount(offer:any, items:CatalogItem[]):Discount|null {
 if(!offer?.id||!offer?.name)return null
 const typeMap:Record<string,DiscountType>={percentage:'PERCENTAGE',flat:'FIXED_AMOUNT',bundle:'COMBO',bogo:'BUY_X_GET_Y',free_delivery:'FREE_DELIVERY'}
 const type=typeMap[offer.type]
 if(!type)return null
 const itemIds=(offer.bogoItems||offer.rules?.includedItems||[]).map((sku:string)=>items.find(item=>item.sku===sku)?.id).filter(Boolean)
 const rewardIds=(offer.bogoRewardItems||[]).map((sku:string)=>items.find(item=>item.sku===sku)?.id).filter(Boolean)
 const rules:any={}
 if(type==='BUY_X_GET_Y'){const rewardMode=offer.bogoRewardMode||'percentage';rules.buyItemIds=itemIds;rules.getItemIds=rewardIds;rules.buyQuantity=offer.buyQuantity||1;rules.getQuantity=offer.getQuantity||1;rules.getBenefit=rewardMode==='fixed_price'?'FIXED_PRICE':rewardMode==='fixed_amount'?'FIXED_AMOUNT':'PERCENTAGE';rules.getValue=rewardMode==='percentage'?(offer.getItemDiscount??offer.bogoRewardValue??100):(offer.bogoRewardValue??0);rules.maxApplications=offer.limits?.maxPerTransaction||1;rules.rewardMode='AUTO'}
 if(type==='COMBO'){rules.requiredItems=(offer.bundleItems||[]).map((sku:string)=>({itemId:items.find(item=>item.sku===sku)?.id,quantity:1})).filter((item:any)=>item.itemId);rules.bundlePrice=offer.bundlePrice||0;rules.maxApplications=offer.limits?.maxPerTransaction||1}
 if(offer.rules?.couponCode)rules.couponCode=String(offer.rules.couponCode).trim().toUpperCase()
 if(offer.rules?.includedCategories?.length)rules.categoryIds=offer.rules.includedCategories
 if(offer.rules?.minSpend)rules.minSubtotal=offer.rules.minSpend
 if(offer.rules?.maxDiscount)rules.maxDiscount=offer.rules.maxDiscount
 const timeWindows=(offer.schedule?.timeWindows||[]).map((window:any)=>({days:offer.schedule?.daysOfWeek?.length?offer.schedule.daysOfWeek:[0,1,2,3,4,5,6],start:window.startTime,end:window.endTime}))
 if(timeWindows.length)rules.schedule={timezone:'Asia/Karachi',windows:timeWindows}
 const applicationModes:DiscountMode[]=offer.applicationMode==='code'?['CODE']:offer.applicationMode==='manual'?['MANUAL']:['AUTOMATIC']
 return {id:offer.id,businessId:'5a09b785-21a2-44ee-9ab7-f21823d8c57c',name:offer.name,type,scope:type==='FREE_DELIVERY'?'DELIVERY':type==='PERCENTAGE'&&!itemIds.length?'ORDER':'ITEM',value:type==='PERCENTAGE'||type==='FIXED_AMOUNT'?offer.discountValue:null,applicationModes,rules,taxTreatment:null,isActive:offer.status==='active',isStackable:offer.isStackable??false,priority:offer.priority??100,startAt:offer.schedule?.startDate||null,endAt:offer.schedule?.endDate||null,maxUses:offer.limits?.maxRedemptions??null,usesPerCustomer:null}
}
