import {sourceElements} from './page-source-lib'
import {FRAME_SHOWN_VAR, readsFrames, recordFrameShown, setPresentedForTest, shownFind} from './shown-lib'

const el = (type: string, x: number, y: number, w: number, h: number, visible: boolean, label = '', kids = '', name = '') =>
  `<XCUIElementType${type} type="XCUIElementType${type}" name="${name}" label="${label}" visible="${visible}" x="${x}" y="${y}" width="${w}" height="${h}">${kids}</XCUIElementType${type}>`

// an unfolded Duo: the app's portrait frame, its landscape window; the base screens read visible=false
const app = (...layers: Array<string>) => el('Application', 0, 0, 669, 951, true, 'Keybase', el('Window', 0, 0, 951, 669, true, '', layers.join('')))
const base = el('Other', 0, 0, 951, 669, false, '', el('StaticText', 10, 40, 100, 20, false, 'Teams') + el('StaticText', 10, 900, 100, 20, false, 'Below'))
// a form sheet, over UIKit's dimming view
const modal = (label: string, visible: boolean) =>
  el(
    'Other',
    0,
    0,
    951,
    669,
    visible,
    '',
    el('Other', -951, -669, 2853, 2007, visible, 'dismiss popup', '', 'PopoverDismissRegion') + el('StaticText', 368, 48, 215, 18, visible, label)
  )
const shown = (source: string) =>
  sourceElements(source)
    .filter(e => e.type === 'XCUIElementTypeStaticText' && e.attrs['visible'] === 'true')
    .map(e => e.attrs['label'])

const FRAME = '(rect.width > 0 AND rect.height > 0 AND rect.x >= 0 AND rect.y >= 0 AND rect.x < 951 AND rect.y < 669)'

afterEach(() => {
  process.env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== FRAME_SHOWN_VAR))
  setPresentedForTest(false)
})

describe('a run that reads XCUITest visible', () => {
  test('page source elements keep their own flag', () => {
    expect(readsFrames()).toBe(false)
    expect(shown(app(base))).toEqual([])
    expect(shown(app(base, modal('step 1', false), modal('step 2', true)))).toEqual(['step 2'])
  })

  test('finds go as written', () => {
    expect(shownFind('-ios predicate string', 'label == "x" AND visible == 1')).toEqual({using: '-ios predicate string', value: 'label == "x" AND visible == 1'})
  })
})

describe('a run that reads frames (an unfolded Duo)', () => {
  beforeEach(() => recordFrameShown({height: 669, width: 951}))

  test('with no modal up, the base screens are shown where their frames are in the window', () => {
    expect(shown(app(base))).toEqual(['Teams'])
  })

  test("with a modal up, XCUITest's flag stands: the covered base and covered steps are not shown", () => {
    expect(shown(app(base, modal('step 1', false), modal('step 2', false), modal('step 3', true)))).toEqual(['step 3'])
  })

  test('with a modal up, its own elements in the window count even when XCUITest reads them hidden', () => {
    expect(shown(app(base, modal('step 1', false), modal('step 2', false)))).toEqual(['step 2'])
  })

  test('with no modal up, a find asking for visible asks for a frame in the window', () => {
    expect(shownFind('-ios predicate string', 'label == "x" AND visible == 1')).toEqual({using: '-ios predicate string', value: `label == "x" AND ${FRAME}`})
    expect(shownFind('-ios class chain', '**/XCUIElementTypeButton[`label == "Back" AND visible == 1`]').value).toBe(
      `**/XCUIElementTypeButton[\`label == "Back" AND ${FRAME}\`]`
    )
  })

  test('a find asking for visible in any spacing, or as true, asks for a frame in the window', () => {
    expect(shownFind('-ios predicate string', 'label == "x" AND visible==1').value).toBe(`label == "x" AND ${FRAME}`)
    expect(shownFind('-ios predicate string', 'visible  ==  true AND label == "x"').value).toBe(`${FRAME} AND label == "x"`)
    expect(shownFind('-ios class chain', '**/XCUIElementTypeButton[`visible == true`]').value).toBe(`**/XCUIElementTypeButton[\`${FRAME}\`]`)
    expect(shownFind('-ios predicate string', 'visible == 10').value).toBe('visible == 10')
  })

  test('with a modal up, a find goes as written', () => {
    setPresentedForTest(true)
    expect(shownFind('-ios predicate string', 'label == "x" AND visible == 1').value).toBe('label == "x" AND visible == 1')
  })

  test('a find that does not ask for visible goes as written', () => {
    expect(shownFind('-ios predicate string', 'label == "x"').value).toBe('label == "x"')
    expect(shownFind('accessibility id', 'visible == 1').value).toBe('visible == 1')
  })
})
