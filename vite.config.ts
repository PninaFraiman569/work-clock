import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** כל הקבצים בתיקייה, כולל תתי-תיקיות, בנתיב יחסי עם / */
function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? listFiles(full, root) : [relative(root, full).replaceAll('\\', '/')]
  })
}

/**
 * יוצר את dist/sw.js מתוך src/serviceWorker.js, עם רשימת כל הקבצים של הגרסה,
 * כדי שהאתר ייפתח גם בלי אינטרנט. בכל בנייה עם שינוי נוצרת גרסה חדשה.
 */
function serviceWorker(): Plugin {
  let publicDir = ''
  return {
    name: 'work-clock-service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir
    },
    generateBundle(_options, bundle) {
      const publicFiles = publicDir ? listFiles(publicDir) : []
      const files = [...Object.keys(bundle), ...publicFiles]
        .filter((f) => f !== 'sw.js')
        .map((f) => (f === 'index.html' ? './' : f))
        .sort()

      const hash = createHash('sha256')
      hash.update(files.join('\n'))
      for (const f of publicFiles) hash.update(readFileSync(join(publicDir, f)))
      const index = bundle['index.html']
      if (index && index.type === 'asset') hash.update(index.source)

      const source = readFileSync('src/serviceWorker.js', 'utf8')
        .replace('__VERSION__', JSON.stringify(hash.digest('hex').slice(0, 12)))
        .replace('__FILES__', JSON.stringify(files))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  build: { chunkSizeWarningLimit: 1200 },
})
