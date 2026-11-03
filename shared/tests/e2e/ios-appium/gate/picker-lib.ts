// The system pickers' pages, read from one page source, and what the app was handed from them.
// Pure: system-ui.ts drives the pickers and device.ts reads the picked files.
import {hasTrait, sourceRect, type SourceElement} from './page-source-lib.ts'

// The photo picker (PHPicker) grid draws the corpus in this order (iOS 26.5, read live). Its cells
// carry no file name, only "Photo, <date>" or "Video, <duration>, <date>", and the picker's search
// finds no file name, so the corpus is found as the one run of cells that share a date and whose
// kinds follow this order. The pick is proven afterwards by the picked files' sha256.
export const LIBRARY_GRID_ORDER = ['e2e-c.png', 'e2e-c.jpg', 'e2e-c.heic', 'e2e-c.gif', 'e2e-c-large.png', 'e2e-c.mov', 'e2e-c.mp4'] as const
export type LibraryName = (typeof LIBRARY_GRID_ORDER)[number]

const kindOf = (name: string): 'Photo' | 'Video' => (/\.(mov|mp4)$/.test(name) ? 'Video' : 'Photo')

// A picker the app opens for photos only (an avatar, an emoji) draws no videos: the corpus's photos,
// in the same order.
export const LIBRARY_PHOTO_ORDER: ReadonlyArray<LibraryName> = LIBRARY_GRID_ORDER.filter(n => kindOf(n) === 'Photo')

export type Rect = {x: number; y: number; width: number; height: number}
export type LibraryCell = {kind: 'Photo' | 'Video'; date: string; rect: Rect; selected: boolean}

// The grid's cells in document order (the grid's order).
export const libraryCells = (els: ReadonlyArray<SourceElement>): Array<LibraryCell> =>
  els.flatMap(e => {
    if (e.type !== 'XCUIElementTypeImage' || e.attrs['name'] !== 'PXGGridLayout-Info') return []
    const parts = (e.attrs['label'] ?? '').split(', ')
    const kind = parts[0]
    if (kind !== 'Photo' && kind !== 'Video') return []
    // a video's label holds its duration before the date
    const date = parts.slice(kind === 'Video' ? 2 : 1).join(', ')
    return [{date, kind, rect: sourceRect(e.attrs), selected: hasTrait(e.attrs['traits'], 'Selected')}]
  })

// The corpus's cells, in `order` (the grid's order, or the photos-only one): the one run of
// consecutive cells sharing a date whose kinds follow the order. Throws when there is none or more
// than one.
export const corpusCells = (
  cells: ReadonlyArray<LibraryCell>,
  order: ReadonlyArray<LibraryName> = LIBRARY_GRID_ORDER
): Array<LibraryCell> => {
  const n = order.length
  const runs: Array<Array<LibraryCell>> = []
  for (let i = 0; i + n <= cells.length; i++) {
    const run = cells.slice(i, i + n)
    const date = run[0]?.date
    if (!date) continue
    // the run is the whole group of that date: not part of a longer one
    if (cells[i - 1]?.date === date || cells[i + n]?.date === date) continue
    if (run.every((c, j) => c.date === date && c.kind === kindOf(order[j] ?? ''))) runs.push(run)
  }
  if (runs.length !== 1) throw new Error(`the photo picker shows ${runs.length} runs of cells that read as the corpus, not one`)
  return runs[0] ?? []
}

export const corpusCellOf = (
  run: ReadonlyArray<LibraryCell>,
  name: LibraryName,
  order: ReadonlyArray<LibraryName> = LIBRARY_GRID_ORDER
) => {
  const cell = run[order.indexOf(name)]
  if (!cell) throw new Error(`the corpus run has no cell for ${name}`)
  return cell
}

// The document picker's cells: a folder is "<name>, Folder", a file "<stem>, <extension>".
const plainName = /^[A-Za-z0-9_.-]{1,80}$/
export const folderCellName = (folder: string) => {
  if (!plainName.test(folder)) throw new Error('refusing a folder name that is not plain')
  return `${folder}, Folder`
}
export const fileCellName = (file: string) => {
  const dot = file.lastIndexOf('.')
  if (!plainName.test(file) || dot <= 0 || dot === file.length - 1) throw new Error('refusing a file name that is not plain with an extension')
  return `${file.slice(0, dot)}, ${file.slice(dot + 1)}`
}

// The picker caches the app copies a pick into, under its data container.
export const PICKER_CACHES = {document: 'Library/Caches/DocumentPicker/', image: 'Library/Caches/ImagePicker/'} as const
export type PickerCache = keyof typeof PICKER_CACHES

// The local file behind a picked file:// url, which must sit in one of the picker caches of the
// app's data container `container`.
export const pickedFilePath = (url: string, container: string) => {
  if (!url.startsWith('file://')) throw new Error('a picked path is not a file url')
  const p = decodeURIComponent(url.slice('file://'.length))
  const root = container.endsWith('/') ? container : `${container}/`
  const rel = p.startsWith(root) ? p.slice(root.length) : undefined
  if (rel === undefined || rel.includes('/../') || !Object.values(PICKER_CACHES).some(c => rel.startsWith(c) && !rel.slice(c.length).includes('/'))) {
    throw new Error("a picked path is not in the app's picker caches")
  }
  return p
}

// Each picked file (in the titles screen's order) is the wanted corpus item, by sha256.
export const requirePicked = (
  picked: ReadonlyArray<{sha256: string}>,
  want: ReadonlyArray<{name: string; sha256: string}>
) => {
  if (picked.length !== want.length) throw new Error(`the app was handed ${picked.length} files, not ${want.length}`)
  picked.forEach((p, i) => {
    const w = want[i]
    if (p.sha256 !== w?.sha256) throw new Error(`picked file ${i + 1} is not the corpus's ${w?.name ?? '?'}`)
  })
}
