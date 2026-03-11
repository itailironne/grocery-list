import { createReadStream } from 'fs'
import { createGunzip } from 'zlib'
import { writeFileSync } from 'fs'

const gz = createReadStream('public/PromoFull7290027600007-199-202603060340.gz')
const gunzip = createGunzip()
let xml = ''

gz.pipe(gunzip)
gunzip.on('data', chunk => xml += chunk.toString())
gunzip.on('end', () => {
  const promos = {} // itemCode -> promotion info

  const promoBlocks = xml.split('<Promotion>').slice(1)

  for (const block of promoBlocks) {
    const get = tag => {
      const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
      return m ? m[1].trim() : null
    }

    const description   = get('PromotionDescription')
    const endDate       = get('PromotionEndDate')
    const rewardType    = get('RewardType')
    const discountRate  = get('DiscountRate')   // basis points when rewardType=2
    const discountedPrice = get('DiscountedPrice')

    // Skip expired promotions
    if (endDate && new Date(endDate) < new Date()) continue

    // Extract all item codes in this promotion
    const itemCodes = [...block.matchAll(/<ItemCode>([^<]+)<\/ItemCode>/g)].map(m => m[1].trim())

    for (const code of itemCodes) {
      // Calculate discount percentage for display
      let discountPct = null
      let fixedPrice  = null

      if (rewardType === '2' && discountRate) {
        // discountRate is in basis points (5000 = 50%)
        discountPct = parseFloat(discountRate) / 100
      } else if (rewardType === '1' && discountedPrice) {
        fixedPrice = parseFloat(discountedPrice)
      }

      // Skip promos with no real discount (credit card deals, loyalty, etc.)
      if (discountPct === null && fixedPrice === null) continue

      // Keep only the best promo per item (prefer percentage discounts)
      const existing = promos[code]
      if (!existing || (discountPct !== null && (existing.discountPct === null || discountPct > existing.discountPct))) {
        promos[code] = { description, discountPct, fixedPrice }
      }
    }
  }

  writeFileSync('public/shufersal_promos.json', JSON.stringify(promos))
  console.log(`Done! ${Object.keys(promos).length} items with promotions.`)
})
