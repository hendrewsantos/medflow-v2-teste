// Ícones em SVG (traço 1.8px, 24×24), desenhados para o protótipo.
import { cru } from './ui.js'
const i = (corpo) => cru(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`)
export const ic = {
  inicio: i('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5h4v5"/>'),
  box: i('<rect x="3.5" y="7" width="17" height="13" rx="2"/><path d="M3.5 11h17M9 7V4.5h6V7M12 11v9"/>'),
  pedidos: i('<path d="M7 4h10l3 3v13H4V7z"/><path d="M8 11h8M8 15h5"/>'),
  receita: i('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h4"/><path d="M9 8h2"/>'),
  dados: i('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5"/>'),
  painel: i('<path d="M4 19V10M9.5 19V5M15 19v-7M20.5 19V8"/>'),
  fila: i('<path d="M6 3h9l4 4v14H6z"/><path d="m9.5 14 2 2 4-4.5"/>'),
  estoque: i('<path d="M3 8 12 3l9 5-9 5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>'),
  usuarios: i('<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.9-3 3-4.6 5.5-4.6s4.6 1.6 5.5 4.6"/><path d="M16 5.5a3 3 0 0 1 0 5.6M18 14.6c1.3.7 2.2 2.2 2.6 4.4"/>'),
  entrega: i('<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
  sair: i('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>'),
  alerta: i('<path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/>'),
  info: i('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>'),
  ok: i('<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>'),
  erro: i('<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>'),
  upload: i('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>'),
  a11y: i('<circle cx="12" cy="4.5" r="1.8"/><path d="M5 8.5c2.3.7 4.6 1 7 1s4.7-.3 7-1M12 9.5V14M9 21l3-7 3 7"/>'),
  relogio: i('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  vazio: i('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M9 14h6"/>'),
  copiar: i('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  raio: i('<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>'),
}
