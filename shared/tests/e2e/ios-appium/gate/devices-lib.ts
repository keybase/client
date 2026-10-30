// The phone's devices list as XCUITest shows it: each row is one accessible element (testID
// devices-row) whose label merges its texts, "<name> (Current device), Last used ..." for the phone's
// own device and "<name> , Last used ..." (or "<name> , Revoked ...") for any other; a new device
// adds its badge between the name and the time. The list is virtualized, so a page source holds the
// rows near the viewport only. Pure: helpers/devices.ts drives the phone.
import {DEVICES_ROW} from '../../shared/test-ids.ts'
import {escapePredicate} from '../helpers/elements.ts'

export type ListRow = {label: string; visible: boolean; y: number}

const entities: Record<string, string> = {amp: '&', apos: "'", gt: '>', lt: '<', quot: '"'}
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e: string) => {
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16))
    if (e.startsWith('#')) return String.fromCodePoint(parseInt(e.slice(1), 10))
    return entities[e] ?? m
  })

const attrsOf = (tag: string) => {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/ ([a-zA-Z]+)="([^"]*)"/g)) out[m[1] ?? ''] = decode(m[2] ?? '')
  return out
}

// The devices rows in an Appium page source, top to bottom.
export const deviceRowsIn = (source: string): Array<ListRow> =>
  [...source.matchAll(/<XCUIElementType[A-Za-z]+ [^>]*>/g)]
    .map(m => attrsOf(m[0]))
    .filter(a => a['name'] === DEVICES_ROW)
    .map(a => ({label: a['label'] ?? '', visible: a['visible'] === 'true', y: Number(a['y'])}))
    .sort((a, b) => a.y - b.y)

// Whether the page source shows the "Revoked devices" divider that ends the active devices.
export const showsRevokedDivider = (source: string) =>
  [...source.matchAll(/<XCUIElementType[A-Za-z]+ [^>]*>/g)].some(m => attrsOf(m[0])['label']?.startsWith('Revoked devices'))

const currentSuffix = ' (Current device), '

// A row's device: its name, whether it is the phone's own and whether the list shows it active.
// Undefined for a label that is not a device row's.
export const rowDevice = (label: string): {name: string; current: boolean; active: boolean} | undefined => {
  const current = label.indexOf(currentSuffix)
  const other = label.indexOf(' , ')
  const cut = current >= 0 && (other < 0 || current < other) ? current : other
  if (cut <= 0) return undefined
  const rest = label.slice(cut + (cut === current ? currentSuffix.length : ' , '.length))
  const active = /(^|, )Last used /.test(rest)
  if (!active && !/(^|, )Revoked /.test(rest)) return undefined
  return {active, current: cut === current, name: label.slice(0, cut)}
}

// Appends what `page` (one screen's rows, in order) adds after the rows already collected. The
// pages must overlap: a page that shares no row with what came before means a scroll skipped rows.
export const mergeRows = (collected: ReadonlyArray<string>, page: ReadonlyArray<string>): Array<string> => {
  if (!collected.length) return [...page]
  const last = collected[collected.length - 1] ?? ''
  const at = page.indexOf(last)
  if (at < 0) {
    if (page.every(n => collected.includes(n))) return [...collected]
    throw new Error(`the list scrolled past rows: the next screen does not start at or before ${last}`)
  }
  return [...collected, ...page.slice(at + 1)]
}

// The row of the device named exactly `name` (its label starts with the name and the row's own
// separator, so "a b" never matches "a bc"), active or revoked.
export const deviceRowPredicate = (name: string) => {
  const n = escapePredicate(name)
  return `-ios predicate string:name == "${DEVICES_ROW}" AND (label BEGINSWITH "${n} , " OR label BEGINSWITH "${n}${currentSuffix}")`
}
