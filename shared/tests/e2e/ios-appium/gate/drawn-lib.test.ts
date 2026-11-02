import {deepestLabelledAtFrame, dragsToward, oneControlAtFrame, steerOffset} from './drawn-lib'
import {sourceParents} from './page-source-lib'

const screen = {height: 800, width: 400, x: 0, y: 0}
const row = (y: number) => ({height: 64, width: 400, x: 0, y})

describe('steerOffset', () => {
  test('a row off screen steers by its offset from the middle, in any list', () => {
    expect(steerOffset(row(1800), screen, false)).toBe(1400)
    expect(steerOffset(row(-300), screen, true)).toBe(-700)
  })

  test("another list's row on screen that no hit drew drags blind", () => {
    expect(steerOffset(row(380), screen, false)).toBeUndefined()
  })

  test('a Files row on screen outside the browser still steers', () => {
    expect(steerOffset(row(20), screen, true)).toBe(-380)
  })

  test('no row in the tree drags blind', () => {
    expect(steerOffset(undefined, screen, true)).toBeUndefined()
  })
})

describe('dragsToward', () => {
  test('one drag per half screen, at least one off the middle, at most four', () => {
    expect(dragsToward(0, 800)).toBe(0)
    expect(dragsToward(10, 800)).toBe(1)
    expect(dragsToward(-401, 800)).toBe(2)
    expect(dragsToward(9000, 800)).toBe(4)
  })
})

describe('sourceParents', () => {
  test('each element reads its parent, self-closing ones holding nothing', () => {
    const xml = `<?xml version="1.0"?><AppiumAUT><XCUIElementTypeApplication name="a"><XCUIElementTypeOther name="b"><XCUIElementTypeButton name="c"/><XCUIElementTypeOther name="d"><XCUIElementTypeStaticText name="e"/></XCUIElementTypeOther></XCUIElementTypeOther><XCUIElementTypeOther name="f"/></XCUIElementTypeApplication></AppiumAUT>`
    expect(sourceParents(xml)).toEqual([-1, 0, 1, 1, 3, 0])
  })
})

describe('oneControlAtFrame', () => {
  const frame = 'x="0" y="300" width="400" height="56"'
  const box = (label: string, inner = '', attrs = `${frame} visible="true"`) =>
    `<XCUIElementTypeOther type="XCUIElementTypeOther" label="${label}" ${attrs}>${inner}</XCUIElementTypeOther>`
  const app = (inner: string) => `<AppiumAUT><XCUIElementTypeApplication type="XCUIElementTypeApplication" x="0" y="0" width="400" height="800">${inner}</XCUIElementTypeApplication></AppiumAUT>`
  const skip = (l: string) => l === 'Skip'
  const at = {matches: skip, rect: {height: 56, width: 400, x: 0, y: 300}, type: 'XCUIElementTypeOther', visibleOnly: true}

  test('nested boxes at one frame that read the label are one control', () => {
    expect(oneControlAtFrame(app(box('Skip', box('Skip', box('Skip')))), at, 'the Skip')).toBe(3)
  })

  test('a box between them that reads another label keeps them on one chain', () => {
    expect(oneControlAtFrame(app(box('Skip', box('Back', box('Skip')))), at, 'the Skip')).toBe(2)
  })

  test('two at the frame in different subtrees (a covered screen) throw', () => {
    const xml = app(`<XCUIElementTypeOther type="XCUIElementTypeOther">${box('Skip')}</XCUIElementTypeOther>${box('Skip')}`)
    expect(() => oneControlAtFrame(xml, at, 'the Skip')).toThrow('2 of the Skip at its frame in different subtrees, not one')
  })

  test('a chain beside another match throws', () => {
    expect(() => oneControlAtFrame(app(box('Skip', box('Skip')) + box('Skip')), at, 'the Skip')).toThrow(
      '3 of the Skip at its frame in different subtrees, not one'
    )
  })

  test('elements at another frame, of another type or not visible when asked do not count', () => {
    const xml = app(
      box('Skip') +
        box('Skip', '', 'x="0" y="400" width="400" height="56" visible="true"') +
        box('Skip', '', `${frame} visible="false"`) +
        `<XCUIElementTypeButton type="XCUIElementTypeButton" label="Skip" ${frame} visible="true"/>`
    )
    expect(oneControlAtFrame(xml, at, 'the Skip')).toBe(1)
    expect(() => oneControlAtFrame(xml, {...at, visibleOnly: false}, 'the Skip')).toThrow('2 of the Skip at its frame in different subtrees')
  })

  test('labels are read with their no-break spaces as spaces', () => {
    expect(oneControlAtFrame(app(box('Add&#xa0;to team')), {...at, matches: l => l === 'Add to team'}, 'the action')).toBe(1)
  })

  test('none at the frame throws', () => {
    expect(() => oneControlAtFrame(app(box('Back')), at, 'the Skip')).toThrow('0 of the Skip at its frame in the page source, not one')
  })
})

describe('deepestLabelledAtFrame', () => {
  const skip = (l: string) => l === 'Skip'

  test('the last fetched that reads the label is the deepest of the chain', () => {
    expect(deepestLabelledAtFrame(['Skip', 'Back', 'Skip', null], skip, 2, 'the Skip')).toBe(2)
  })

  test('labels are read with their no-break spaces as spaces', () => {
    expect(deepestLabelledAtFrame(['Add to team'], l => l === 'Add to team', 1, 'the action')).toBe(0)
  })

  test('another count than the page source read (the tree moved) throws', () => {
    expect(() => deepestLabelledAtFrame(['Skip', 'Skip', 'Skip'], skip, 2, 'the Skip')).toThrow('3 of the Skip at its frame, 2 in the page source')
    expect(() => deepestLabelledAtFrame(['Back', null], skip, 1, 'the Skip')).toThrow('0 of the Skip at its frame, 1 in the page source')
  })
})
