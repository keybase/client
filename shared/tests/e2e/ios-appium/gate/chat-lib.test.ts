import {carriedTeam, findInboxRow, forwardResultMatches, inboxRowMatches, persistedMismatch, shiftIntoBand, visibleBand, wholly} from './chat-lib'

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

describe('forwardResultMatches', () => {
  test('a result matches by a whole field of its label', () => {
    expect(forwardResultMatches('testuser', 'testuser')).toBe(true)
    expect(forwardResultMatches('testuser, testuser', 'testuser')).toBe(true)
  })

  test('a result of a longer name, or of a group holding the name, does not match', () => {
    expect(forwardResultMatches('testuser-mac', 'testuser')).toBe(false)
    expect(forwardResultMatches('testuser,testuser-mac', 'testuser')).toBe(false)
    expect(forwardResultMatches('team#testuser', 'testuser')).toBe(false)
  })

  test('an empty name matches nothing', () => {
    expect(forwardResultMatches('', '')).toBe(false)
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
const header = (team: string | undefined, top: number) => ({kind: 'header' as const, span: span(top, top + 50), team})

// the e2e team's name, and other teams'
const H = 'testteam'
const A = 'testteam-a'
const X = 'testteam-x'

describe('findInboxRow', () => {
  test('a small conversation is found by name, whatever section it is in', () => {
    const items = [small('testuser, 3:04 PM, hi', 100), small('testuser-mac, 3:05 PM, hi', 160)]
    expect(findInboxRow(items, 'testuser-mac', H, undefined)).toBe(1)
    expect(findInboxRow(items, 'testuser-other', H, undefined)).toBeUndefined()
  })

  test("a channel is found only under the team's own header", () => {
    const items = [header(A, 100), channel('# general', 150), header(H, 190), channel('# general', 240)]
    expect(findInboxRow(items, '#general', H, undefined)).toBe(3)
  })

  test('a channel of another team with the same name is never picked', () => {
    const items = [header(H, 100), channel('# random', 150), header(A, 190), channel('# general', 240)]
    expect(findInboxRow(items, '#general', H, undefined)).toBeUndefined()
  })

  test('rows are sorted by y before they take a section, whatever order they were read in', () => {
    const items = [channel('# general', 240), header(A, 190), channel('# random', 150), header(H, 100)]
    expect(findInboxRow(items, '#general', H, undefined)).toBeUndefined()
    expect(findInboxRow(items, '#random', H, undefined)).toBe(2)
  })

  test("another team's channels above an older drawn header are not ours, though our header is drawn below", () => {
    // X's channels, then A, then H; after a drag X's header is gone but A is still drawn
    const before = [header(X, 40), channel('# random', 90), channel('# general', 130), header(A, 600), header(H, 700)]
    const carried = carriedTeam(before, 100, undefined)
    expect(carried).toBe(X)
    const after = [channel('# general', 30), header(A, 80), header(H, 180), channel('# random', 230)]
    expect(findInboxRow(after, '#general', H, carried)).toBeUndefined()
    expect(findInboxRow(after, '#random', H, carried)).toBe(3)
  })

  test('a team longer than a screen: rows under our header stay ours once it scrolls off', () => {
    const before = [header(H, 40), channel('# a', 90), channel('# b', 130)]
    const carried = carriedTeam(before, 100, undefined)
    expect(carried).toBe(H)
    const after = [channel('# c', 100), channel('# general', 140), channel('# d', 180)]
    expect(findInboxRow(after, '#general', H, carried)).toBe(1)
  })

  test('with no header seen yet, a channel above the first drawn header is not ours', () => {
    const items = [channel('# general', 100), header(H, 140), channel('# other', 190)]
    expect(findInboxRow(items, '#general', H, undefined)).toBeUndefined()
    expect(findInboxRow(items, '#other', H, undefined)).toBe(2)
  })

  test('a header whose team name was not read is not ours', () => {
    expect(findInboxRow([header(undefined, 100), channel('# general', 150)], '#general', H, undefined)).toBeUndefined()
  })

  test('a "#name" never matches a small conversation, and a plain name never a channel', () => {
    expect(findInboxRow([small('#general, 3:04 PM, hi', 100)], '#general', H, H)).toBeUndefined()
    expect(findInboxRow([header(H, 100), channel('# general', 150)], 'general', H, H)).toBeUndefined()
  })

  test('a name more than one drawn row matches is refused, without naming it', () => {
    const items = [small('testuser-mac, 3:04 PM, hi', 100), small('testuser-mac, 3:05 PM, yo', 160)]
    expect(() => findInboxRow(items, 'testuser-mac', H, undefined)).toThrow('more than one inbox row matches the name asked for')
    expect(() => findInboxRow(items, 'testuser-mac', H, undefined)).not.toThrow(/testuser/)
    const twice = [header(H, 100), channel('# general', 150), channel('# general', 190)]
    expect(() => findInboxRow(twice, '#general', H, undefined)).toThrow('more than one')
  })
})

describe('carriedTeam', () => {
  test('the team of the lowest header at or above the list top, by name', () => {
    expect(carriedTeam([header(X, 10), header(A, 60), channel('# a', 110), header(H, 300)], 100, undefined)).toBe(A)
  })

  test('with no header above the list top the carried team goes on, even when one is drawn below', () => {
    expect(carriedTeam([channel('# a', 100), header(A, 300)], 100, H)).toBe(H)
    expect(carriedTeam([small('testuser, 1, 2', 100)], 100, undefined)).toBeUndefined()
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
