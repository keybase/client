import {sourceElements} from './page-source-lib'
import {corpusCellOf, corpusCells, fileCellName, folderCellName, LIBRARY_PHOTO_ORDER, libraryCells, pickedFilePath, requirePicked} from './picker-lib'

const cell = (label: string, i: number, selected = false) =>
  `<XCUIElementTypeImage type="XCUIElementTypeImage" name="PXGGridLayout-Info" label="${label}" enabled="true" visible="false" accessible="true" x="${(i % 3) * 134}" y="${307 + Math.floor(i / 3) * 134}" width="133" height="133" index="${i}" traits="${selected ? 'Selected, Image' : 'Image'}"/>`

const NEW = 'November 01, 7:17 PM'
const corpusLabels = [
  ...Array.from({length: 5}, () => `Photo, ${NEW}`),
  `Video, two seconds, ${NEW}`,
  `Video, two seconds, ${NEW}`,
]
const older = ['Photo, October 24, 11:33 AM', 'Video, five seconds, October 17, 6:42 PM']

const grid = (labels: ReadonlyArray<string>, selected: ReadonlyArray<number> = []) =>
  libraryCells(sourceElements(`<root>${labels.map((l, i) => cell(l, i, selected.includes(i))).join('')}</root>`))

describe('picker-lib', () => {
  test('reads the grid cells: kind, date without a video duration, frame and selection', () => {
    const cells = grid([`Video, two seconds, ${NEW}`, `Photo, ${NEW}`], [1])
    expect(cells).toEqual([
      {date: NEW, kind: 'Video', rect: {height: 133, width: 133, x: 0, y: 307}, selected: false},
      {date: NEW, kind: 'Photo', rect: {height: 133, width: 133, x: 134, y: 307}, selected: true},
    ])
  })

  test('finds the one run of the corpus and maps names to its cells in grid order', () => {
    const run = corpusCells(grid([...corpusLabels, ...older]))
    expect(run).toHaveLength(7)
    expect(corpusCellOf(run, 'e2e-c.png').rect).toMatchObject({x: 0, y: 307})
    expect(corpusCellOf(run, 'e2e-c.mov').rect).toMatchObject({x: 268, y: 441})
    expect(corpusCellOf(run, 'e2e-c.mp4').rect).toMatchObject({x: 0, y: 575})
  })

  test('finds the corpus below newer items of another date', () => {
    const run = corpusCells(grid(['Photo, November 02, 9:00 AM', ...corpusLabels]))
    expect(corpusCellOf(run, 'e2e-c.png').rect).toMatchObject({x: 134, y: 307})
  })

  test('refuses no run, a run whose kinds do not follow the order, two runs, or a run inside a longer group', () => {
    expect(() => corpusCells(grid(older))).toThrow('0 runs')
    const swapped = [...corpusLabels]
    swapped[0] = `Video, two seconds, ${NEW}`
    swapped[5] = `Photo, ${NEW}`
    expect(() => corpusCells(grid(swapped))).toThrow('0 runs')
    const other = corpusLabels.map(l => l.replace(NEW, 'May 01, 1:00 PM'))
    expect(() => corpusCells(grid([...corpusLabels, ...other]))).toThrow('2 runs')
    expect(() => corpusCells(grid([`Photo, ${NEW}`, ...corpusLabels]))).toThrow('0 runs')
  })

  test('finds the photos-only run, which has no videos, and refuses the full grid there', () => {
    const photos = Array.from({length: 5}, () => `Photo, ${NEW}`)
    const run = corpusCells(grid([...photos, ...older]), LIBRARY_PHOTO_ORDER)
    expect(run).toHaveLength(5)
    expect(corpusCellOf(run, 'e2e-c.png', LIBRARY_PHOTO_ORDER).rect).toMatchObject({x: 0, y: 307})
    expect(corpusCellOf(run, 'e2e-c-large.png', LIBRARY_PHOTO_ORDER).rect).toMatchObject({x: 134, y: 441})
    expect(() => corpusCellOf(run, 'e2e-c.mp4', LIBRARY_PHOTO_ORDER)).toThrow('no cell')
    expect(() => corpusCells(grid(corpusLabels), LIBRARY_PHOTO_ORDER)).toThrow('0 runs')
  })

  test('names the document picker cells, refusing names that are not plain', () => {
    expect(folderCellName('e2e-9f0ru0-pick-ab12')).toBe('e2e-9f0ru0-pick-ab12, Folder')
    expect(fileCellName('e2e-c.pdf')).toBe('e2e-c, pdf')
    expect(() => folderCellName('a" OR 1')).toThrow('not plain')
    expect(() => fileCellName('noextension')).toThrow('not plain')
  })

  test("takes a picked file only inside the app's picker caches", () => {
    const c = '/sim/data/Containers/Data/Application/APP'
    expect(pickedFilePath(`file://${c}/Library/Caches/ImagePicker/A.png`, c)).toBe(`${c}/Library/Caches/ImagePicker/A.png`)
    expect(pickedFilePath(`file://${c}/Library/Caches/DocumentPicker/B%20C.pdf`, c)).toBe(`${c}/Library/Caches/DocumentPicker/B C.pdf`)
    expect(() => pickedFilePath(`${c}/Library/Caches/ImagePicker/A.png`, c)).toThrow('not a file url')
    expect(() => pickedFilePath(`file://${c}/Documents/A.png`, c)).toThrow('picker caches')
    expect(() => pickedFilePath(`file://${c}/Library/Caches/ImagePicker/x/A.png`, c)).toThrow('picker caches')
    expect(() => pickedFilePath(`file:///other/Library/Caches/ImagePicker/A.png`, c)).toThrow('picker caches')
  })

  test('proves each picked file is its corpus item, in order', () => {
    const want = [
      {name: 'e2e-c.png', sha256: 'aa'},
      {name: 'e2e-c.mp4', sha256: 'bb'},
    ]
    expect(() => requirePicked([{sha256: 'aa'}, {sha256: 'bb'}], want)).not.toThrow()
    expect(() => requirePicked([{sha256: 'bb'}, {sha256: 'aa'}], want)).toThrow('picked file 1 is not')
    expect(() => requirePicked([{sha256: 'aa'}], want)).toThrow('handed 1 files, not 2')
  })
})
