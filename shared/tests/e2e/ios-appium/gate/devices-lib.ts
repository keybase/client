// The phone's devices list as XCUITest shows it: each row is one accessible element (testID
// devices-row) whose label merges its texts, "<name> (Current device), Last used ..." for the phone's
// own device and "<name> , Last used ..." (or "<name> , Revoked ...") for any other; a new device
// adds its badge between the name and the time. The list is virtualized, so a page source holds the
// rows near the viewport only. Pure: helpers/devices.ts drives the phone.
import {DEVICES_ROW} from '../../shared/test-ids.ts'
import {escapePredicate} from '../helpers/elements.ts'
import {sourceElements} from './page-source-lib.ts'
import type {LoggedCall} from '../../shared/call-log.ts'
import {uiCallsOf} from './recorder-lib.ts'

export type ListRow = {label: string; visible: boolean; y: number}

// The devices rows in an Appium page source, top to bottom.
export const deviceRowsIn = (source: string): Array<ListRow> =>
  sourceElements(source)
    .map(e => e.attrs)
    .filter(a => a['name'] === DEVICES_ROW)
    .map(a => ({label: a['label'] ?? '', visible: a['visible'] === 'true', y: Number(a['y'])}))
    .sort((a, b) => a.y - b.y)

// Whether the page source shows the "Revoked devices" divider that ends the active devices.
export const showsRevokedDivider = (source: string) =>
  sourceElements(source).some(e => e.attrs['label']?.startsWith('Revoked devices'))

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
// `shown` is how an error names a device (paperKeyMasked).
export const mergeRows = (collected: ReadonlyArray<string>, page: ReadonlyArray<string>, shown: (name: string) => string = n => n): Array<string> => {
  if (!collected.length) return [...page]
  const last = collected[collected.length - 1] ?? ''
  const at = page.indexOf(last)
  if (at < 0) {
    if (page.every(n => collected.includes(n))) return [...collected]
    throw new Error(`the list scrolled past rows: the next screen does not start at or before ${shown(last)}`)
  }
  return [...collected, ...page.slice(at + 1)]
}

// The row of the device named exactly `name` (its label starts with the name and the row's own
// separator, so "a b" never matches "a bc"), active or revoked.
export const deviceRowPredicate = (name: string) => {
  const n = escapePredicate(name)
  return `-ios predicate string:name == "${DEVICES_ROW}" AND (label BEGINSWITH "${n} , " OR label BEGINSWITH "${n}${currentSuffix}")`
}

export type TypedDevice = {name: string; type: string}

// How an error names a device: a paper key's name is the first two words of its phrase, so any
// device the account has (or had) as a paper key is only "a paper key".
export const paperKeyMasked = (devices: ReadonlyArray<TypedDevice>) => {
  const keys = new Set(devices.filter(d => d.type === 'backup').map(d => d.name))
  return (name: string) => (keys.has(name) ? 'a paper key' : name)
}

// Undefined when the list shows exactly the service's active devices; otherwise what differs, with
// paper keys counted, never named. `history` is every device the account had, to tell a paper key
// the list shows but the service does not list as active.
export const deviceListProblem = (shown: ReadonlyArray<string>, active: ReadonlyArray<TypedDevice>, history: ReadonlyArray<TypedDevice>) => {
  const want = new Set(active.map(d => d.name))
  const have = new Set(shown)
  const isKey = new Set(history.filter(d => d.type === 'backup').map(d => d.name))
  const describe = (names: Array<string>) => {
    const keys = names.filter(n => isKey.has(n)).length
    return [...names.filter(n => !isKey.has(n)), ...(keys ? [`${keys} paper key${keys > 1 ? 's' : ''}`] : [])].join(', ')
  }
  const missing = [...want].filter(n => !have.has(n)).sort()
  const extra = [...have].filter(n => !want.has(n)).sort()
  const dupes = shown.length - have.size
  if (!missing.length && !extra.length && !dupes) return undefined
  return [
    missing.length ? `the list does not show ${describe(missing)}` : '',
    extra.length ? `the list shows ${describe(extra)}, which the service does not list as active` : '',
    dupes ? `the list shows ${dupes} name${dupes > 1 ? 's' : ''} twice` : '',
  ]
    .filter(Boolean)
    .join('; ')
}

// The devices list's reads after a device add, from the app's call log (calls the UI sent since a mark
// taken before the add): each deviceHistoryList that went out after the add was answered, with its
// error if it failed. `settled` once the add was answered and the latest read since then was answered
// without an error: the list then shows what the service had then. An earlier read never answered
// (cancelled, or its screen unmounted) does not hold it up; a failed latest read leaves the list as it
// was, so it settles nothing.
export const postAddListReads = (calls: ReadonlyArray<LoggedCall>): {settled: boolean; reads: Array<{answered: boolean; error?: string}>} => {
  const add = uiCallsOf(calls, 'keybase.1.device.deviceAdd').at(-1)
  if (!add?.answer) return {reads: [], settled: false}
  const after = add.answer.afterSeq
  const reads = uiCallsOf(calls, 'keybase.1.device.deviceHistoryList')
    .filter(c => c.seq > after)
    .map(c => (c.answer ? {answered: true, ...(c.answer.error === undefined ? {} : {error: c.answer.error})} : {answered: false}))
  const latest = reads.at(-1)
  const settled = !!latest?.answered && latest.error === undefined
  return {reads, settled}
}

// A step name for the reads: how many there were, and each failed one's error.
export const postAddReadsSummary = (reads: ReadonlyArray<{answered: boolean; error?: string}>) => {
  const failed = reads.filter(r => r.error !== undefined)
  const head = `The devices list read ${reads.length} time${reads.length === 1 ? '' : 's'} after the add`
  return failed.length ? `${head}, ${failed.length} failed: ${failed.map(r => r.error).join('; ')}` : `${head}, none failed`
}
