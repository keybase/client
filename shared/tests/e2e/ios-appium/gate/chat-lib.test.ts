import {findInboxRow, inboxRowMatches, persistedMismatch, sectionAfter, shiftIntoBand, visibleBand, wholly} from './chat-lib'

describe('inboxRowMatches', () => {
  test('a small conversation row matches by the exact name its label starts with', () => {
    expect(inboxRowMatches('testuser-mac, 3:04 PM, hello', 'testuser-mac')).toBe(true)
    expect(inboxRowMatches('testuser,testuser-mac, Yesterday, Draft: hi', 'testuser,testuser-mac')).toBe(true)
  })

  test('a row whose name only starts with the asked-for name does not match', () => {
    expect(inboxRowMatches('testuser-mac, 3:04 PM, hello', 'testuser')).toBe(false)
    expect(inboxRowMatches('testuser,testuser-mac, 3:04 PM, hello', 'testuser')).toBe(false)
  })

  test('the name must be the first field, not appear later in the label', () => {
    expect(inboxRowMatches('testuser-mac, 3:04 PM, testuser', 'testuser')).toBe(false)
  })

  test('a row whose label is only the name matches', () => {
    expect(inboxRowMatches('testuser', 'testuser')).toBe(true)
  })

  test('a big team channel row, drawn "# name", matches "#name" and nothing longer', () => {
    expect(inboxRowMatches('# general', '#general')).toBe(true)
    expect(inboxRowMatches('# general-e2e', '#general')).toBe(false)
    expect(inboxRowMatches('# general', 'general')).toBe(false)
  })

  test('an empty name matches nothing', () => {
    expect(inboxRowMatches('', '')).toBe(false)
    expect(inboxRowMatches(', 3:04 PM', '')).toBe(false)
  })
})

describe('persistedMismatch', () => {
  test('a value equal in depth to the one wanted is no mismatch', () => {
    expect(persistedMismatch('the setting', {a: [1, 2]}, {a: [1, 2]})).toBeUndefined()
  })

  test('a different value names what was read, what came back and what was wanted', () => {
    expect(persistedMismatch('the mobile notifications', 'never', 'onAnyActivity')).toBe(
      'the mobile notifications after a relaunch: "never", want "onAnyActivity"'
    )
  })
})

const span = (top: number, bottom = top + 60) => ({bottom, top})
const small = (label: string, top: number) => ({kind: 'small' as const, label, span: span(top)})
const channel = (label: string, top: number) => ({kind: 'channel' as const, label, span: span(top, top + 40)})
const header = (ours: boolean, top: number) => ({kind: 'header' as const, ours, span: span(top, top + 50)})

describe('findInboxRow', () => {
  test('a small conversation is found by name, whatever section it is in', () => {
    const items = [small('testuser, 3:04 PM, hi', 100), small('testuser-mac, 3:05 PM, hi', 160)]
    expect(findInboxRow(items, 'testuser-mac', false)).toBe(1)
    expect(findInboxRow(items, 'testuser-other', false)).toBeUndefined()
  })

  test("a channel is found only under the team's own header", () => {
    const items = [header(false, 100), channel('# general', 150), header(true, 190), channel('# general', 240)]
    expect(findInboxRow(items, '#general', false)).toBe(3)
  })

  test("a channel of another team with the same name is never picked", () => {
    const items = [header(true, 100), channel('# random', 150), header(false, 190), channel('# general', 240)]
    expect(findInboxRow(items, '#general', false)).toBeUndefined()
  })

  test('channels above the first drawn header belong to the section carried from the scroll before', () => {
    const items = [channel('# general', 100), header(false, 140), channel('# other', 190)]
    expect(findInboxRow(items, '#general', true)).toBe(0)
    expect(findInboxRow(items, '#general', false)).toBeUndefined()
  })

  test('a "#name" never matches a small conversation, and a plain name never a channel', () => {
    expect(findInboxRow([small('#general, 3:04 PM, hi', 100)], '#general', true)).toBeUndefined()
    expect(findInboxRow([header(true, 100), channel('# general', 150)], 'general', true)).toBeUndefined()
  })

  test('a name more than one drawn row matches is refused, without naming it', () => {
    const items = [small('testuser-mac, 3:04 PM, hi', 100), small('testuser-mac, 3:05 PM, yo', 160)]
    expect(() => findInboxRow(items, 'testuser-mac', false)).toThrow('more than one inbox row matches the name asked for')
    expect(() => findInboxRow(items, 'testuser-mac', false)).not.toThrow(/testuser/)
    const twice = [header(true, 100), channel('# general', 150), channel('# general', 190)]
    expect(() => findInboxRow(twice, '#general', false)).toThrow('more than one')
  })
})

describe('sectionAfter', () => {
  test('the last drawn header decides the section that goes on below the view', () => {
    expect(sectionAfter([header(true, 100), channel('# a', 150), header(false, 190)], true)).toBe(false)
    expect(sectionAfter([header(false, 100), header(true, 190), channel('# a', 240)], false)).toBe(true)
  })

  test('with no header drawn the carried section goes on', () => {
    expect(sectionAfter([channel('# a', 100)], true)).toBe(true)
    expect(sectionAfter([small('testuser, 1, 2', 100)], false)).toBe(false)
  })
})

describe('the inbox band rows are seen through', () => {
  const list = {bottom: 800, top: 100}

  test('with nothing over the list the band is the list', () => {
    expect(visibleBand(list, [])).toEqual(list)
  })

  test('a bar over the bottom of the list (the floating divider, the tab bar) cuts the band above it', () => {
    expect(visibleBand(list, [span(760, 800), span(780, 850)])).toEqual({bottom: 760, top: 100})
  })

  test('a cover over the top of the list cuts the band below it, and one off the list changes nothing', () => {
    expect(visibleBand(list, [span(90, 130), span(820, 900), span(0, 50)])).toEqual({bottom: 800, top: 130})
  })

  test('a row the floating bar covers is not wholly in view, and the shift brings it above the bar', () => {
    const band = visibleBand(list, [span(740, 800)])
    const row = span(700, 764)
    expect(wholly(row, band, 4)).toBe(false)
    const dy = shiftIntoBand(row, band, 4)
    expect(dy).toBeLessThan(0)
    const moved = {bottom: row.bottom + dy, top: row.top + dy}
    expect(wholly(moved, band, 4)).toBe(true)
  })

  test('a row cut off at the top is shifted down into the band', () => {
    const band = visibleBand(list, [])
    const row = span(80, 140)
    expect(wholly(row, band, 4)).toBe(false)
    const dy = shiftIntoBand(row, band, 4)
    expect(dy).toBeGreaterThan(0)
    expect(wholly({bottom: row.bottom + dy, top: row.top + dy}, band, 4)).toBe(true)
  })

  test('a row inside the band needs no shift', () => {
    const band = visibleBand(list, [])
    expect(wholly(span(300), band, 4)).toBe(true)
    expect(shiftIntoBand(span(300), band, 4)).toBe(0)
  })
})
