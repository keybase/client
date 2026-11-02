import {checkRowSearch, dragsToward, oneLabelledAtFrame, steerOffset} from './drawn-lib'

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

describe('checkRowSearch', () => {
  test('inTree with within is refused', () => {
    expect(() => checkRowSearch({inTree: true, within: true})).toThrow('a row search takes inTree or within, not both')
  })

  test('either alone, or neither, is fine', () => {
    expect(() => checkRowSearch({inTree: true, within: false})).not.toThrow()
    expect(() => checkRowSearch({inTree: false, within: true})).not.toThrow()
    expect(() => checkRowSearch({inTree: false, within: false})).not.toThrow()
  })
})

describe('oneLabelledAtFrame', () => {
  const skip = (l: string) => l === 'Skip'

  test('the one element at the frame that reads the label', () => {
    expect(oneLabelledAtFrame(['Back', 'Skip', null], skip, 'the Skip')).toBe(1)
  })

  test('labels are read with their no-break spaces as spaces', () => {
    expect(oneLabelledAtFrame(['Add\u00a0to team'], l => l === 'Add to team', 'the action')).toBe(0)
  })

  test('two that read the label (a covered screen at the same frame) throw', () => {
    expect(() => oneLabelledAtFrame(['Skip', 'Skip'], skip, 'the Skip')).toThrow('2 of the Skip at its frame, not one')
  })

  test('none that reads it throws', () => {
    expect(() => oneLabelledAtFrame(['Back', null], skip, 'the Skip')).toThrow('0 of the Skip at its frame, not one')
  })
})
