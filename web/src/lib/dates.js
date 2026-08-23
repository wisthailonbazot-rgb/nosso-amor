// Datas no app.
//
// Regra unica, gemea da que existe no backend (`clock.py`): dia de calendario e
// SEMPRE a string "YYYY-MM-DD", e nunca vira `new Date(texto)` — porque
// `new Date('2026-08-22')` e interpretado como meia-noite em UTC e, no fuso de
// Brasilia, exibe 21/08. Foi exatamente esse erro que ja quebrou uma tela de
// vencimento em outro projeto. Aqui a data e desmontada na mao.

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** "2026-08-22" -> {y, m, d} sem passar por Date. */
export function parts(day) {
  if (!day || typeof day !== 'string') return null
  const [y, m, d] = day.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

/** Dia de calendario -> Date ao MEIO-DIA local: imune a fuso e a horario de verao. */
export function toLocalDate(day) {
  const p = parts(day)
  return p ? new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0) : null
}

/** Date local -> "YYYY-MM-DD". Nunca use toISOString aqui: ele converte pra UTC. */
export function toDayString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function today() {
  return toDayString(new Date())
}

export function addDays(day, amount) {
  const date = toLocalDate(day)
  if (!date) return null
  date.setDate(date.getDate() + amount)
  return toDayString(date)
}

export function diffDays(from, to) {
  const a = toLocalDate(from)
  const b = toLocalDate(to)
  if (!a || !b) return null
  return Math.round((b - a) / 86400000)
}

export function daysTogether(startDay) {
  if (!startDay) return null
  const diff = diffDays(startDay, today())
  return diff === null || diff < 0 ? null : diff
}

export function prettyDay(day, { short = false } = {}) {
  const p = parts(day)
  if (!p) return ''
  const mes = short ? MESES_CURTO[p.m - 1] : MESES[p.m - 1]
  return `${p.d} de ${mes}${short ? '' : ` de ${p.y}`}`
}

export function shortDay(day) {
  const p = parts(day)
  return p ? `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}` : ''
}

export function weekdayName(day) {
  const date = toLocalDate(day)
  return date ? DIAS[date.getDay()] : ''
}

/** Rotulo humano pra dia: hoje / ontem / amanha / a data. */
export function relativeDay(day) {
  const diff = diffDays(today(), day)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  if (diff === -1) return 'ontem'
  if (diff > 1 && diff < 7) return weekdayName(day)
  return shortDay(day)
}

/** Instante ISO (com fuso) -> "14:32". */
export function clockTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** Instante ISO -> "hoje 14:32" / "ontem 09:10" / "12/08 09:10". */
export function stamp(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  const day = toDayString(date)
  const label = relativeDay(day)
  return `${label} ${clockTime(iso)}`
}
