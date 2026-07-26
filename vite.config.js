import { defineConfig } from 'vite';
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { readdirSync } from 'fs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const srcDir = resolve(__dirname, 'src')

const findHtmlFiles = (dir) => {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(dir, entry.name)

    if (entry.isDirectory()) {
      return findHtmlFiles(fullPath)
    }

    return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : []
  })
}

const htmlFiles = findHtmlFiles(srcDir)


export default defineConfig({
   base: './', 
   root: srcDir,   // ✅ keeps dev server working
   envDir: resolve(__dirname),        // ✅ load .env from the project root instead of src/
   server: {
    host: true,
    port: 3000,
    hot: true,
    open: true,
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "sass:math";`
      }
    }
  },
    build: {
    outDir: resolve(__dirname, 'dist'), // ✅ output outside src
    emptyOutDir: true,
    rollupOptions: {
      input: htmlFiles.length
        ? Object.fromEntries(
            htmlFiles.map(file => [
              file.replace(`${srcDir}\\`, '').replace(`${srcDir}/`, '').replace(/\.html$/, ''),
              file,
            ])
          )
        : resolve(__dirname, 'src/index.html'),
         output: {
          chunkFileNames: 'assets/js/[name].js',
          entryFileNames: 'assets/js/[name].js',

          assetFileNames: ({name}) => {
            if (/\.(gif|jpe?g|png|svg)$/.test(name ?? '')){
                return 'assets/images/[name][extname]';
            }

            if (/\.css$/.test(name ?? '')) {
                return 'assets/css/[name][extname]';
            }

            // default value
            // ref: https://rollupjs.org/guide/en/#outputassetfilenames
            return 'assets/[name][extname]';
          },



      },
    },
  },
});
