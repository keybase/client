import {framePredicate, labelHas, labelParts, sourceElements, sourceRect} from './page-source-lib'

test('labelParts splits at the ", " joins, reads a no-break space as a space and trims each part', () => {
  expect(labelParts('testuser, Owner\u00a0 ,  12\u00a0members, 1\u202fGB')).toEqual(['testuser', 'Owner', '12 members', '1 GB'])
  expect(labelParts('')).toEqual([''])
  expect(labelHas('a, b c', 'b c')).toBe(true)
  expect(labelHas('a, b c', 'b')).toBe(false)
})

test("sourceRect reads an element's frame, which framePredicate asks for exactly", () => {
  const [e] = sourceElements('<XCUIElementTypeOther type="XCUIElementTypeOther" x="1" y="2" width="30" height="40.5">')
  const r = sourceRect(e!.attrs)
  expect(r).toEqual({height: 40.5, width: 30, x: 1, y: 2})
  expect(framePredicate(r)).toBe('rect.x == 1 AND rect.y == 2 AND rect.width == 30 AND rect.height == 40.5')
})
