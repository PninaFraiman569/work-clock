// שומר במחשב את קבצי האתר, כדי שייפתח גם בלי אינטרנט.
// הקובץ הזה הוא תבנית: בזמן הבנייה (npm run build) נוצר ממנו dist/sw.js
// עם רשימת הקבצים של הגרסה. ראו vite.config.ts.
// הבקשות לשרת הנתונים (Supabase) לא עוברות כאן: הן בכתובת אחרת.

const VERSION = __VERSION__
const FILES = __FILES__
const CACHE = `work-clock-${VERSION}`
const ROOT = new URL('./', self.registration.scope).href

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(new URL(f, self.registration.scope), { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  )
})

// גרסה חדשה של האתר: מוחקים את הקבצים של הגרסאות הקודמות
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('work-clock-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // הדף עצמו: קודם מהאינטרנט, כדי לקבל את הגרסה האחרונה. בלי חיבור, מהמחשב.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone()
            void caches.open(CACHE).then((cache) => cache.put(ROOT, copy))
          }
          return res
        })
        .catch(() => caches.match(ROOT).then((hit) => hit || Response.error())),
    )
    return
  }

  // שאר הקבצים: מהמחשב אם יש, אחרת מהאינטרנט
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.pathname.includes('/assets/')) {
            const copy = res.clone()
            void caches.open(CACHE).then((cache) => cache.put(req, copy))
          }
          return res
        }),
    ),
  )
})
