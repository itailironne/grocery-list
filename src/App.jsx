import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import emailjs from '@emailjs/browser'
import './App.css'

// ── EmailJS config ─────────────────────────────────────────────
// Sign up free at https://www.emailjs.com, connect your email,
// create a template, then paste your IDs here.
const EMAILJS_PUBLIC_KEY  = 'jCTfKd70TfDuSFQ2F'   // Account > API Keys
const EMAILJS_SERVICE_ID  = 'service_6c0wy79'     // Email Services
const EMAILJS_TEMPLATE_ID = 'template_cv9uvuk'    // Email Templates
// ──────────────────────────────────────────────────────────────

// ── Price matching ───────────────────────────────────────────
function similarity(a, b) {
  const na = a.toLowerCase().trim()
  const nb = b.toLowerCase().trim()
  const wordsA = na.split(/\s+/).filter(w => w.length > 1)
  const wordsB = nb.split(/\s+/).filter(w => w.length > 1)
  if (wordsA.length === 0 || wordsB.length === 0) return 0
  let matches = 0
  for (const w of wordsA) {
    if (wordsB.some(wb => {
      const shorter = w.length <= wb.length ? w : wb
      const longer  = w.length <= wb.length ? wb : w
      return longer.includes(shorter) && shorter.length / longer.length >= 0.7
    })) matches++
  }
  return matches / wordsA.length
}

function findByName(productName, prices) {
  if (!productName.trim() || prices.length === 0) return null
  let best = null, bestScore = 0
  for (const item of prices) {
    const score = similarity(productName, item.name)
    if (score > bestScore) { bestScore = score; best = item }
  }
  return bestScore >= 0.6 ? best : null
}

// Find prices across all stores: use name match first, then barcode cross-reference
function findAllPrices(productName, prices) {
  const { shufersal, ramiLevi, hetziHinam } = prices
  const byCode = (store, code) => store.find(i => i.code === code) || null

  // Step 1: try name match in each store
  let s = findByName(productName, shufersal)
  let r = findByName(productName, ramiLevi)
  let h = findByName(productName, hetziHinam)

  // Step 2: if any store found a match, use its barcode to look up the others exactly
  const code = (s || r || h)?.code
  if (code) {
    if (!s) s = byCode(shufersal, code)
    if (!r) r = byCode(ramiLevi,  code)
    if (!h) h = byCode(hetziHinam, code)
    // If we had a name match, prefer barcode lookup over name match for accuracy
    if (s?.code !== code) s = byCode(shufersal, code) || s
    if (r?.code !== code) r = byCode(ramiLevi,  code) || r
    if (h?.code !== code) h = byCode(hetziHinam, code) || h
  }

  return { s, r, h }
}
// ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'produce',   label: 'פירות וירקות',  emoji: '🥦' },
  { id: 'dairy',     label: 'חלב וביצים',   emoji: '🥛' },
  { id: 'meat',      label: 'בשר ודגים',    emoji: '🥩' },
  { id: 'bakery',    label: 'מאפים',        emoji: '🍞' },
  { id: 'frozen',    label: 'קפואים',       emoji: '🧊' },
  { id: 'beverages', label: 'משקאות',       emoji: '🥤' },
  { id: 'snacks',    label: 'חטיפים',       emoji: '🍫' },
  { id: 'pantry',    label: 'מזווה',        emoji: '🥫' },
  { id: 'household', label: 'ניקיון ובית',  emoji: '🧹' },
  { id: 'personal',  label: 'טיפוח אישי',  emoji: '🧴' },
  { id: 'other',     label: 'אחר',          emoji: '📦' },
]

function getCategoryMeta(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1]
}

const THUMB_COLORS = {
  produce:   '#e8f5e9',
  dairy:     '#e3f2fd',
  meat:      '#fce4ec',
  bakery:    '#fff3e0',
  frozen:    '#e0f7fa',
  beverages: '#f3e5f5',
  snacks:    '#fffde7',
  pantry:    '#fbe9e7',
  household: '#f5f5f5',
  personal:  '#fce4ec',
  other:     '#f2f2f7',
}

// Returns true only when `keyword` appears as a whole word inside `text`
function matchesKeyword(text, keyword) {
  const kw = keyword.toLowerCase()
  const idx = text.indexOf(kw)
  if (idx === -1) return false
  const isWordChar = c => /[a-z0-9\u0590-\u05FF]/.test(c)
  const before = idx > 0 ? text[idx - 1] : ''
  const after = idx + kw.length < text.length ? text[idx + kw.length] : ''
  return (!before || !isWordChar(before)) && (!after || !isWordChar(after))
}

const CATEGORY_KEYWORDS = {
  produce: [
    'apple','apples','banana','bananas','tomato','tomatoes','lettuce','carrot','carrots',
    'onion','onions','potato','potatoes','cucumber','cucumbers','pepper','peppers','spinach',
    'broccoli','zucchini','eggplant','celery','garlic','ginger','lemon','lemons','lime','limes',
    'orange','oranges','grape','grapes','strawberry','strawberries','blueberry','blueberries',
    'mango','watermelon','melon','pear','pears','peach','peaches','plum','plums',
    'cherry','cherries','avocado','avocados','corn','mushroom','mushrooms','cabbage',
    'cauliflower','kale','arugula','cilantro','parsley','mint','basil','fruit','vegetable',
    'vegetables','salad','fresh','thyme','rosemary','dill','sage','chives','beet','beets',
    'leek','leeks','radish','radishes','asparagus','pineapple','pomegranate','fig','figs',
    'apricot','apricots','nectarine','herbs','fennel','artichoke','scallion','scallions',
    'turnip','kohlrabi',
    // Hebrew
    'תפוח','תפוחים','בננה','בננות','עגבניה','עגבניות','חסה','גזר','גזרים',
    'בצל','בצלים','תפוח אדמה','תפוחי אדמה','מלפפון','מלפפונים','פלפל','פלפלים',
    'תרד','ברוקולי','קישוא','קישואים','חצילים','חציל','סלרי','שום','לימון','לימונים',
    'תפוז','תפוזים','ענבים','ענב','תות','תותים','אוכמניות','מנגו','אבטיח','מלון',
    'אגס','אגסים','אפרסק','שזיף','שזיפים','דובדבן','דובדבנים','אבוקדו','תירס',
    'פטריות','פטריה','כרוב','כרובית','קייל','כוסברה','פטרוזיליה','נענע','בזיליקום',
    'פרי','פירות','ירק','ירקות','סלט','טרי','טריים','תימין','רוזמרין','שמיר',
    'סלק','כרישה','כרישות','צנון','אספרגוס','אננס','רימון','תאנה','תאנים',
    'משמש','נקטרינה','שומר','ארטישוק','קולורבי',
  ],
  dairy: [
    'milk','cheese','yogurt','butter','sour cream','cream cheese','whipped cream',
    'egg','eggs','cottage','mozzarella','cheddar','parmesan','feta','brie','gouda',
    'ricotta','kefir','dairy','oat milk','almond milk','soy milk',
    // Hebrew
    'חלב','גבינה','גבינות','יוגורט','חמאה','שמנת','שמנת חמוצה','ביצה','ביצים',
    'קוטג','מוצרלה','פרמזן','פטה','גאודה','ריקוטה','קצפת','קפיר','מוצרי חלב','לבן',
    'חלב שקדים','חלב שיבולת שועל','חלב סויה',
  ],
  meat: [
    'chicken','beef','pork','fish','salmon','tuna','shrimp','turkey','lamb','veal',
    'steak','sausage','bacon','ham','duck','cod','tilapia','sardine','sardines',
    'anchovy','anchovies','crab','lobster','meat','minced','ground beef','ground chicken',
    'liver','schnitzel','fillet','pastrami','deli',
    // Hebrew
    'עוף','חזה עוף','כנפיים','שוקיים','בקר','חזיר','דג','דגים','סלמון','טונה',
    'שרימפס','הודו','כבש','עגל','סטייק','טחון','נקניק','בייקון','ברווז','בשר',
    'כבד','שניצל','פילה','פסטרמה','קציצות',
  ],
  bakery: [
    'bread','roll','rolls','bun','buns','bagel','bagels','croissant','muffin','muffins',
    'cake','pastry','pastries','cookie','cookies','pita','tortilla','sourdough','rye',
    'baguette','ciabatta','focaccia','pretzel','pretzels','donut','donuts',
    // Hebrew
    'לחם','לחמניה','לחמניות','כיכר','בגל','קרואסון','מאפין','עוגה','עוגות',
    'מאפה','מאפים','עוגייה','עוגיות','פיתה','פיתות','טורטייה','שיפון','באגט',
    'פרצל','סופגניה','סופגניות',
  ],
  frozen: [
    'frozen','ice cream','popsicle','gelato','sorbet','french fries','frozen pizza',
    'fish sticks','fish fingers','nuggets','waffles',
    // Hebrew
    'קפוא','קפואים','גלידה','ארטיק','סורבה','צ\'יפס','פיצה קפואה','נאגטס',
    'אצבעות דג','וופל',
  ],
  beverages: [
    'juice','water','soda','cola','coffee','tea','beer','wine','smoothie',
    'lemonade','sparkling','drink','beverage','energy drink','sports drink',
    // Hebrew
    'מיץ','מים','סודה','קולה','קפה','תה','בירה','יין','סמוזי',
    'לימונדה','מים מוגזים','מים מינרלים','משקה','שתייה','נס קפה',
  ],
  snacks: [
    'chips','chocolate','candy','nuts','popcorn','crackers','granola','snack',
    'gummy','gummies','trail mix','dried fruit','peanuts','almonds','cashews',
    'walnuts','pistachios','pretzels','rice cakes','energy bar','granola bar',
    // Hebrew
    'שוקולד','ממתק','ממתקים','אגוזים','פופקורן','קרקר','קרקרים',
    'גרנולה','חטיף','חטיפים','גומי','פירות יבשים','בוטנים','שקדים',
    'קשיו','אגוזי מלך','פיסטוקים','ביסלי','במבה','אחלה',
  ],
  pantry: [
    'pasta','rice','flour','sugar','salt','oil','vinegar','sauce','ketchup','mustard',
    'mayonnaise','canned','beans','lentils','chickpeas','cereal','oats','honey','jam',
    'peanut butter','tahini','hummus','spice','spices','cumin','paprika','oregano',
    'olive oil','cornflakes','cornstarch','quinoa','couscous','bulgur','barley',
    'cocoa','syrup','maple syrup','breadcrumbs','baking soda','baking powder','yeast',
    'noodles','soup','broth','stock','nutella','tomato paste',
    // Hebrew
    'פסטה','אורז','קמח','סוכר','מלח','שמן','חומץ','רוטב','קטשופ','חרדל',
    'מיונז','שימורים','שעועית','עדשים','קורנפלקס','שיבולת שועל','דבש','ריבה',
    'חמאת בוטנים','טחינה','תבלין','תבלינים','כמון','פפריקה','אורגנו','שמן זית',
    'קינואה','קוסקוס','בורגול','שעורה','קקאו','סירופ','פירורי לחם','סודה לשתייה',
    'אבקת אפייה','שמרים','אטריות','מרק אבקה','נוטלה','רסק עגבניות',
  ],
  household: [
    'toilet paper','paper towel','paper towels','detergent','bleach','sponge','trash bag',
    'dish soap','aluminum foil','plastic wrap','fabric softener','cleaning','laundry',
    'mop','broom','dustpan','disinfectant','garbage bag','foil',
    // Hebrew
    'נייר טואלט','מגבת נייר','אבקת כביסה','אקונומיקה','ספוג','שקית אשפה',
    'נייר כסף','ניילון נצמד','נוזל כלים','מרכך בד','נייר אפייה','ניקיון',
    'חומר ניקוי','מטאטא',
  ],
  personal: [
    'soap','shampoo','conditioner','toothpaste','toothbrush','deodorant','razor',
    'lotion','sunscreen','medicine','vitamin','moisturizer','face wash','body wash',
    'cotton','bandage','band-aid','perfume','cologne','makeup','lipstick','mascara',
    'nail polish','hair gel','hair spray','floss','mouthwash',
    // Hebrew
    'סבון','שמפו','מרכך','משחת שיניים','מברשת שיניים','דאודורנט',
    'קרם','קרם הגנה','תרופה','ויטמין','ניקוי פנים','כותנה','פלסטר',
    'בושם','מייקאפ','לק','ג\'ל שיער','חוט דנטלי','שטיפת פה',
  ],
}

function detectCategory(productName) {
  const lower = productName.toLowerCase().trim()
  if (!lower) return null
  // Pick the category whose longest keyword matches (avoids "corn" stealing "popcorn"/"cornflakes")
  let bestCat = null
  let bestLen = 0
  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (keyword.length > bestLen && matchesKeyword(lower, keyword.toLowerCase())) {
        bestCat = catId
        bestLen = keyword.length
      }
    }
  }
  return bestCat
}

export default function App() {
  const [products, setProducts] = useState(() => {
    try {
      const saved = localStorage.getItem('grocery-list')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [mode, setMode]         = useState('edit')   // 'edit' | 'shopping'
  const [name, setName]         = useState('')
  const [category, setCategory] = useState('produce')
  const [addMode, setAddMode] = useState('single') // 'single' | 'bulk' | 'barcode'
  const [bulkText, setBulkText] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeResult, setBarcodeResult] = useState(null) // { name, category } | 'not_found'
  const [barcodeSuggestions, setBarcodeSuggestions] = useState([])
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef(null)
  const [wifeEmail, setWifeEmail]   = useState('')
  const [emailStatus, setEmailStatus] = useState(null) // null | 'sending' | 'sent' | 'error'
  const [prices, setPrices] = useState({ shufersal: [], ramiLevi: [], hetziHinam: [] })
  const [promos, setPromos] = useState({})

  useEffect(() => {
    localStorage.setItem('grocery-list', JSON.stringify(products))
  }, [products])

  useEffect(() => {
    Promise.all([
      fetch('/shufersal_prices.json').then(r => r.json()).catch(() => []),
      fetch('/rami_levi_prices.json').then(r => r.json()).catch(() => []),
      fetch('/hetzi_hinam_prices.json').then(r => r.json()).catch(() => []),
      fetch('/shufersal_promos.json').then(r => r.json()).catch(() => ({})),
    ]).then(([shufersal, ramiLevi, hetziHinam, shufersalPromos]) => {
      setPrices({ shufersal, ramiLevi, hetziHinam })
      setPromos(shufersalPromos)
    })
  }, [])

  // ── Edit mode actions ──────────────────────────────────────────
  const addProduct = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setProducts([...products, { id: Date.now(), name: trimmed, category, status: 'pending' }])
    setName('')
  }

  const addBulk = () => {
    const lines = bulkText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
    if (lines.length === 0) return
    const newProducts = lines.map((line, i) => ({
      id: Date.now() + i,
      name: line,
      category: detectCategory(line) || 'other',
      status: 'pending',
    }))
    setProducts([...products, ...newProducts])
    setBulkText('')
    setBulkMode(false)
  }

  const deleteProduct = (id) => setProducts(products.filter(p => p.id !== id))

  const resetList = () => setProducts(products.map(p => ({ ...p, status: 'pending' })))

  // ── Shopping mode actions ──────────────────────────────────────
  const setStatus = (id, status) =>
    setProducts(products.map(p => p.id === id ? { ...p, status } : p))

  // ── Group products by category, preserving CATEGORIES order ───
  const grouped = CATEGORIES
    .map(cat => ({
      ...cat,
      items: products.filter(p => p.category === cat.id),
    }))
    .filter(cat => cat.items.length > 0)

  // ── Stats ──────────────────────────────────────────────────────
  const total     = products.length
  const inBag     = products.filter(p => p.status === 'in_bag').length
  const notFound  = products.filter(p => p.status === 'not_found').length
  const pending   = total - inBag - notFound

  // ── Price totals ───────────────────────────────────────────────
  const totals = products.reduce((acc, p) => {
    const { s, r, h } = findAllPrices(p.name, prices)
    if (s) { acc.shufersal  += s.price; acc.shufersalCount++  }
    if (r) { acc.ramiLevi   += r.price; acc.ramiLeviCount++   }
    if (h) { acc.hetziHinam += h.price; acc.hetziHinamCount++ }
    return acc
  }, { shufersal: 0, shufersalCount: 0, ramiLevi: 0, ramiLeviCount: 0, hetziHinam: 0, hetziHinamCount: 0 })

  const sendReport = async () => {
    if (!wifeEmail.trim()) { alert('אנא הכנס את כתובת האימייל של אשתך.'); return }
    if (EMAILJS_PUBLIC_KEY === 'YOUR_PUBLIC_KEY') { alert('אנא הגדר את פרטי EmailJS ב-App.jsx תחילה.'); return }

    const date    = new Date().toLocaleString()
    const inBagList    = products.filter(p => p.status === 'in_bag')
    const notFoundList = products.filter(p => p.status === 'not_found')
    const pendingList  = products.filter(p => p.status === 'pending')

    const lines = [
      `🛒 דוח קניות`,
      `תאריך: ${date}`,
      ``,
      `סיכום:`,
      `✅ נמצא: ${inBagList.length} פריטים`,
      `❌ לא נמצא: ${notFoundList.length} פריטים`,
      `⏳ לא נבדק: ${pendingList.length} פריטים`,
    ]

    if (inBagList.length > 0) {
      lines.push(``, `✅ בתיק:`)
      inBagList.forEach(p => lines.push(`  • ${p.name} (${getCategoryMeta(p.category).label})`))
    }
    if (notFoundList.length > 0) {
      lines.push(``, `❌ לא נמצא:`)
      notFoundList.forEach(p => lines.push(`  • ${p.name} (${getCategoryMeta(p.category).label})`))
    }
    if (pendingList.length > 0) {
      lines.push(``, `⏳ לא נבדק:`)
      pendingList.forEach(p => lines.push(`  • ${p.name} (${getCategoryMeta(p.category).label})`))
    }

    lines.push(``, `──────────────────────`)
    lines.push(`אהובתי, רציתי שתדעי שהשקעתי את כל הלב בקנייה הזו 💪`)
    lines.push(`עברתי על כל המדפים, חיפשתי בכל הפינות, ועשיתי הכל כדי להביא הביתה את מה שביקשת.`)
    lines.push(`אוהב אותך ❤️`)

    setEmailStatus('sending')
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        { to_email: wifeEmail.trim(), subject: 'דוח קניות', message: lines.join('\n') },
        EMAILJS_PUBLIC_KEY,
      )
      setEmailStatus('sent')
    } catch (err) {
      console.error('EmailJS error:', err)
      setEmailStatus('error')
    }
  }

  const lookupBarcode = (code) => {
    const all = [...prices.shufersal, ...prices.ramiLevi, ...prices.hetziHinam]
    const found = all.find(i => i.code === code)
    if (found) {
      setBarcodeResult({ name: found.name, category: detectCategory(found.name) || 'other' })
    } else {
      setBarcodeResult('not_found')
    }
  }

  const addBarcodeProduct = () => {
    if (!barcodeResult || barcodeResult === 'not_found') return
    setProducts(prev => [...prev, { id: Date.now(), name: barcodeResult.name, category: barcodeResult.category, status: 'pending' }])
    setBarcodeInput('')
    setBarcodeResult(null)
    stopScanner()
  }

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    setScanning(false)
  }

  const startScanner = async () => {
    setScanning(true)
    setBarcodeResult(null)
    await new Promise(r => setTimeout(r, 100))
    const scanner = new Html5Qrcode('barcode-reader')
    scannerRef.current = scanner
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 120 } },
      (code) => {
        setBarcodeInput(code)
        lookupBarcode(code)
        stopScanner()
      },
      () => {}
    ).catch(() => setScanning(false))
  }

  const startShopping = () => {
    resetList()
    setMode('shopping')
  }

  return (
    <div className="app" dir="rtl">
      <div className="card">

        {/* ── Header ── */}
        <div className="header">
          <div className="header-left">
            <h1>רשימת קניות</h1>
          </div>
          <div className="header-right">
            {total > 0 && <span className="cart-badge">{total}</span>}
            {mode === 'edit' ? (
              <button
                className="mode-btn shop"
                onClick={startShopping}
                disabled={total === 0}
              >
                השוואה
              </button>
            ) : (
              <button className="mode-btn edit" onClick={() => setMode('edit')}>
                עריכה
              </button>
            )}
          </div>
        </div>

        {/* ── Compare banner ── */}
        {mode === 'edit' && total > 0 && (
          <div className="compare-banner">
            <span className="compare-banner-text">רוצה למצוא את המחיר הכי טוב?</span>
            <button className="compare-banner-btn" onClick={startShopping}>
              בוא נשווה ←
            </button>
          </div>
        )}

        {/* ── Add form (edit mode only) ── */}
        {mode === 'edit' && (
          <div className="add-section">
            <div className="add-toggle">
              <button className={`toggle-btn ${addMode === 'single' ? 'active' : ''}`} onClick={() => { setAddMode('single'); stopScanner() }}>+ יחיד</button>
              <button className={`toggle-btn ${addMode === 'bulk'   ? 'active' : ''}`} onClick={() => { setAddMode('bulk');   stopScanner() }}>≡ הדבק רשימה</button>
              <button className={`toggle-btn ${addMode === 'barcode'? 'active' : ''}`} onClick={() => { setAddMode('barcode'); setBarcodeResult(null); setBarcodeInput('') }}>📷 ברקוד</button>
            </div>

            {addMode === 'single' ? (
              <div className="add-form">
                <div className="input-wrap">
                  <input
                    type="text"
                    placeholder="שם מוצר..."
                    value={name}
                    onChange={e => {
                      const val = e.target.value
                      setName(val)
                      const detected = detectCategory(val)
                      if (detected) setCategory(detected)
                      if (val.trim().length >= 2) {
                        const all = [
                          ...prices.shufersal.map(i => i.name),
                          ...prices.ramiLevi.map(i => i.name),
                          ...prices.hetziHinam.map(i => i.name),
                        ]
                        const lower = val.toLowerCase()
                        const unique = [...new Set(all.filter(n => n.toLowerCase().includes(lower)))]
                        setSuggestions(unique.slice(0, 6))
                      } else {
                        setSuggestions([])
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { addProduct(); setSuggestions([]) }
                      if (e.key === 'Escape') setSuggestions([])
                    }}
                    onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                  />
                  {suggestions.length > 0 && (
                    <ul className="suggestions-list">
                      {suggestions.map((s, i) => (
                        <li key={i} onMouseDown={() => {
                          setName(s)
                          const detected = detectCategory(s)
                          if (detected) setCategory(detected)
                          setSuggestions([])
                        }}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                  ))}
                </select>
                <button className="add-btn" onClick={() => { addProduct(); setSuggestions([]) }}>הוסף</button>
              </div>
            ) : addMode === 'bulk' ? (
              <div className="bulk-form">
                <textarea
                  placeholder={"מוצר אחד בשורה, לדוגמה:\nחלב\nלחם\nביצים"}
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  rows={5}
                />
                <button className="add-btn bulk-add-btn" onClick={addBulk}>הוסף הכל</button>
              </div>
            ) : (
              <div className="barcode-form">
                <div className="barcode-input-row">
                  <div className="input-wrap">
                    <input
                      type="text"
                      placeholder="הזן מספר ברקוד..."
                      value={barcodeInput}
                      onChange={e => {
                        const val = e.target.value
                        setBarcodeInput(val)
                        setBarcodeResult(null)
                        if (val.trim().length >= 3) {
                          const all = [...prices.shufersal, ...prices.ramiLevi, ...prices.hetziHinam]
                          const matches = all.filter(i => i.code.startsWith(val.trim()))
                          const unique = [...new Map(matches.map(i => [i.code, i])).values()]
                          setBarcodeSuggestions(unique.slice(0, 6))
                        } else {
                          setBarcodeSuggestions([])
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { lookupBarcode(barcodeInput.trim()); setBarcodeSuggestions([]) }
                        if (e.key === 'Escape') setBarcodeSuggestions([])
                      }}
                      onBlur={() => setTimeout(() => setBarcodeSuggestions([]), 150)}
                    />
                    {barcodeSuggestions.length > 0 && (
                      <ul className="suggestions-list">
                        {barcodeSuggestions.map((item, i) => (
                          <li key={i} onMouseDown={() => {
                            setBarcodeInput(item.code)
                            setBarcodeSuggestions([])
                            lookupBarcode(item.code)
                          }}>
                            <span className="suggestion-code">{item.code}</span> — {item.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button className="add-btn" onClick={() => { lookupBarcode(barcodeInput.trim()); setBarcodeSuggestions([]) }}>חפש</button>
                  <button className="scan-btn" onClick={scanning ? stopScanner : startScanner}>
                    {scanning ? '⏹ עצור' : '📷 סרוק'}
                  </button>
                </div>
                <div id="barcode-reader" style={{ width: '100%', display: scanning ? 'block' : 'none' }} />
                {barcodeResult === 'not_found' && <p className="barcode-msg error">המוצר לא נמצא לברקוד זה.</p>}
                {barcodeResult && barcodeResult !== 'not_found' && (
                  <div className="barcode-found">
                    <span className="barcode-found-name">{barcodeResult.name}</span>
                    <button className="add-btn" onClick={addBarcodeProduct}>+ הוסף</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Shopping progress bar ── */}
        {mode === 'shopping' && total > 0 && (
          <div className="progress-wrap">
            <div className="progress-bar">
              <div className="bar-bag"   style={{ width: `${(inBag    / total) * 100}%` }} />
              <div className="bar-miss"  style={{ width: `${(notFound / total) * 100}%` }} />
            </div>
            <div className="progress-labels">
              <span className="lbl-bag">✓ {inBag} בתיק</span>
              <span className="lbl-pend">{pending} נותרו</span>
              <span className="lbl-miss">✕ {notFound} לא נמצא</span>
            </div>
          </div>
        )}

        {/* ── Send report (shopping mode only) ── */}
        {mode === 'shopping' && (
          <div className="email-section">
            <input
              type="email"
              placeholder="כתובת אימייל של אשתך..."
              value={wifeEmail}
              onChange={e => { setWifeEmail(e.target.value); setEmailStatus(null) }}
              className="email-input"
            />
            <button
              className="send-btn"
              onClick={sendReport}
              disabled={emailStatus === 'sending'}
            >
              {emailStatus === 'sending' ? 'שולח...' : 'שלח דוח'}
            </button>
            {emailStatus === 'sent'  && <span className="email-ok">✓ הדוח נשלח!</span>}
            {emailStatus === 'error' && <span className="email-err">✕ שגיאה בשליחה</span>}
          </div>
        )}

        {/* ── Cost comparison panel ── always visible ── */}
        {(() => {
          const rows = [
            { key: 'shufersal',  label: 'שופרסל',  total: totals.shufersal,  count: totals.shufersalCount,  cls: 'shufersal'  },
            { key: 'ramiLevi',   label: 'רמי לוי',  total: totals.ramiLevi,   count: totals.ramiLeviCount,   cls: 'rami-levi'  },
            { key: 'hetziHinam', label: 'חצי חינם', total: totals.hetziHinam, count: totals.hetziHinamCount, cls: 'hetzi-hinam' },
          ]
          const hasAny = rows.some(r => r.count > 0)
          const minTotal = hasAny ? Math.min(...rows.filter(r => r.count > 0).map(r => r.total)) : null
          const cheapest = hasAny ? rows.filter(r => r.count > 0 && r.total === minTotal) : []
          return (
            <div className="cost-panel">
              <h3 className="cost-title">השוואת מחירים</h3>
              <div className="cost-rows">
                {rows.map(r => (
                  <div key={r.key} className={`cost-row ${r.cls} ${hasAny && r.count > 0 && r.total === minTotal ? 'cheapest' : ''}`}>
                    <span className="cost-store-dot" />
                    <span className="cost-store">{r.label}</span>
                    <span className="cost-items">{r.count} פריטים</span>
                    <span className="cost-total">₪{r.total.toFixed(2)}</span>
                    {hasAny && r.count > 0 && r.total === minTotal && rows.filter(x => x.count > 0).length > 1 && (
                      <span className="cost-cheapest-tag">הכי זול</span>
                    )}
                  </div>
                ))}
              </div>
              {cheapest.length > 0 && rows.filter(r => r.count > 0).length > 1 && (
                <div className="cost-verdict">
                  {cheapest[0].label} הכי זול 🏆
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Empty state ── */}
        {total === 0 && (
          <div className="empty">
            <div className="empty-icon">🛒</div>
            <h2 className="empty-title">הרשימה ריקה</h2>
            <p className="empty-subtitle">
              הוסף מוצרים לרשימה ונמצא לך<br />
              באיזה סופר הכי משתלם לקנות
            </p>
            <p className="empty-suggestions-label">התחל עם:</p>
            <div className="empty-chips">
              {['חלב', 'לחם', 'ביצים', 'עגבניות', 'גבינה', 'קוטג׳', 'עוף', 'פסטה'].map(s => (
                <button
                  key={s}
                  className="empty-chip"
                  onClick={() => setProducts(prev => [...prev, {
                    id: Date.now() + Math.random(),
                    name: s,
                    category: detectCategory(s) || 'other',
                    status: 'pending',
                  }])}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Grouped product list ── */}
        {grouped.map(cat => (
          <div key={cat.id} className="category-group">
            <div className="category-header">
              <span className="cat-emoji">{cat.emoji}</span>
              <span className="cat-label">{cat.label}</span>
              <span className="cat-count">{cat.items.length}</span>
            </div>

            <ul className="product-list">
              {cat.items.map(product => {
                const { s, r, h } = findAllPrices(product.name, prices)
                const allP = [s?.price, r?.price, h?.price].filter(Boolean)
                const minPrice = allP.length ? Math.min(...allP) : null
                return (
                  <li
                    key={product.id}
                    className={`product-item status-${product.status}`}
                  >
                    <div
                      className="product-thumb"
                      style={{ background: THUMB_COLORS[cat.id] || '#f2f2f7' }}
                    >
                      {cat.emoji}
                    </div>
                    <div className="product-info">
                      <span className="product-name">{product.name}</span>
                      <div className="product-prices">
                        {s && (() => {
                          const promo = promos[s.code]
                          const discountedPrice = promo
                            ? promo.fixedPrice !== null
                              ? promo.fixedPrice
                              : promo.discountPct !== null
                                ? s.price * (1 - promo.discountPct / 100)
                                : null
                            : null
                          const effectivePrice = discountedPrice ?? s.price
                          return (
                            <div className={`price-cell shufersal ${effectivePrice === minPrice ? 'cheaper' : ''}`}>
                              <span className="price-store-name">🟢 שופרסל</span>
                              <span className="price-value">
                                {discountedPrice !== null ? (
                                  <><span className="price-original">₪{s.price.toFixed(2)}</span> ₪{discountedPrice.toFixed(2)}</>
                                ) : (
                                  <>₪{s.price.toFixed(2)}</>
                                )}
                                {s.weighted && <span className="price-unit">/ק"ג</span>}
                              </span>
                              {promo && <span className="promo-badge">🏷️ {promo.description}</span>}
                            </div>
                          )
                        })()}
                        {r && (
                          <div className={`price-cell rami-levi ${r.price === minPrice ? 'cheaper' : ''}`}>
                            <span className="price-store-name">🔴 רמי לוי</span>
                            <span className="price-value">₪{r.price.toFixed(2)}{r.weighted && <span className="price-unit">/ק"ג</span>}</span>
                          </div>
                        )}
                        {h && (
                          <div className={`price-cell hetzi-hinam ${h.price === minPrice ? 'cheaper' : ''}`}>
                            <span className="price-store-name">🟡 חצי חינם</span>
                            <span className="price-value">₪{h.price.toFixed(2)}{h.weighted && <span className="price-unit">/ק"ג</span>}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {mode === 'edit' && (
                      <button
                        className="delete-btn"
                        onClick={() => deleteProduct(product.id)}
                        title="הסר"
                      >✕</button>
                    )}

                    {mode === 'shopping' && (
                      <div className="action-btns">
                        <button
                          className={`bag-btn ${product.status === 'in_bag' ? 'active' : ''}`}
                          onClick={() => setStatus(product.id, product.status === 'in_bag' ? 'pending' : 'in_bag')}
                          title="בתיק"
                        >✓</button>
                        <button
                          className={`miss-btn ${product.status === 'not_found' ? 'active' : ''}`}
                          onClick={() => setStatus(product.id, product.status === 'not_found' ? 'pending' : 'not_found')}
                          title="לא נמצא"
                        >✕</button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {/* ── Footer ── */}
        {total > 0 && (
          <div className="footer">
            <span>{total} מוצרים ברשימה</span>
            {mode === 'edit' && (
              <button className="clear-btn" onClick={() => setProducts([])}>
                נקה הכל
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
