// Gera o protótipo como um único arquivo (HTML + CSS + JS embutidos) para publicação.
import { build } from '/opt/npm-tools/node_modules/esbuild/lib/main.js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const raiz = new URL('.', import.meta.url).pathname
const png = (f) => 'data:image/png;base64,' + readFileSync(raiz + '../frontend/public/' + f).toString('base64')
mkdirSync(raiz + 'dist', { recursive: true })
writeFileSync(raiz + 'src/assets.js', `export const SIMBOLO = ${JSON.stringify(png('simbolo-medflow.png'))}\n`)

const r = await build({ entryPoints: [raiz + 'src/main.js'], bundle: true, format: 'iife', target: 'es2022', minify: true, write: false, legalComments: 'none' })
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
const css = readFileSync(raiz + '../frontend/src/styles/app.css', 'utf8')
const fontes = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&family=Lexend:wght@400;500;600;700&display=swap'
const cabeca = `<title>MedFlow Solutions</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontes}">
<style>${css}</style>`
const corpo = `<div id="app"></div><div id="modal"></div><div class="toasts" id="toasts" aria-live="polite"></div>
<script>${js}</script>`
// Versão para publicar (sem doctype/head/body: o Artifact adiciona o esqueleto)
writeFileSync(raiz + 'dist/medflow-prototipo.html', cabeca + '\n' + corpo + '\n')
// Versão para testar localmente no navegador
writeFileSync(raiz + 'dist/teste-local.html', `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${cabeca}</head><body>${corpo}</body></html>`)
console.log('ok', (js.length / 1024).toFixed(0) + ' KB de JS')
