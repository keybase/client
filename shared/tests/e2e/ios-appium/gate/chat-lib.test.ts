import {
  carriedTeam,
  findInboxHeader,
  findInboxRow,
  forwardResultMatches,
  inNameSection,
  inboxIn,
  inboxRowMatches,
  innermost,
  notifyChoiceOf,
  persistedMismatch,
  sheetItemLabels,
  shiftIntoBand,
  visibleBand,
  wholly,
} from './chat-lib'
import {sourceElements} from './page-source-lib'
import {CHAT_INBOX_BIG_TEAM_HEADER, CHAT_INBOX_CHANNEL_ROW, CHAT_INBOX_ROW, CHAT_INBOX_UNREAD_SHORTCUT} from '../../shared/test-ids'

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

  test("a pinned row, its pin's icon glyph first, matches by the name after it", () => {
    expect(inboxRowMatches('\ue95d, testuser, 3:04 PM, hello', 'testuser')).toBe(true)
    expect(inboxRowMatches('\ue95d, testuser-mac, 3:04 PM, hello', 'testuser')).toBe(false)
    // only an icon glyph is skipped, not any first field
    expect(inboxRowMatches('x, testuser, 3:04 PM, hello', 'testuser')).toBe(false)
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

describe('findInboxHeader', () => {
  const header = (team: string | undefined, top: number) => ({kind: 'header' as const, span: {bottom: top + 30, top}, team})
  const small = (label: string, top: number) => ({kind: 'small' as const, label, span: {bottom: top + 60, top}})

  test('finds the header of the team by its exact name', () => {
    const items = [header('otherteam', 0), small('testuser', 40), header('e2eteam', 100)]
    expect(findInboxHeader(items, 'e2eteam')).toBe(2)
  })

  test('a header of a longer team name, or one whose name was not read, is not it', () => {
    expect(findInboxHeader([header('e2eteam.sub', 0), header(undefined, 40)], 'e2eteam')).toBeUndefined()
  })

  test('an empty team name matches nothing', () => {
    expect(findInboxHeader([header('', 0)], '')).toBeUndefined()
  })

  test('two headers of the team are refused', () => {
    expect(() => findInboxHeader([header('e2eteam', 0), header('e2eteam', 100)], 'e2eteam')).toThrow(/more than one/)
  })
})

describe('innermost', () => {
  test('of a box and the text inside it, only the text', () => {
    const box = {height: 60, width: 300, x: 0, y: 100}
    const text = {height: 20, width: 100, x: 10, y: 110}
    expect(innermost([box, text])).toEqual([1])
  })

  test('two apart are both kept', () => {
    expect(innermost([{height: 20, width: 100, x: 0, y: 0}, {height: 20, width: 100, x: 0, y: 50}])).toEqual([0, 1])
  })

  // XCUITest reports an RN text inside a text twice, at one frame: one thing on screen
  test('two of the same rect count once, as the first', () => {
    const r = {height: 20, width: 100, x: 0, y: 0}
    expect(innermost([r, {...r}])).toEqual([0])
    const box = {height: 60, width: 300, x: 0, y: 100}
    const text = {height: 20, width: 100, x: 10, y: 110}
    expect(innermost([box, text, {...text}])).toEqual([1])
  })
})

describe('inNameSection', () => {
  const at = (y: number) => ({height: 20, width: 200, x: 0, y})
  const chats = at(100)

  test('a match between the Chats header and the next header is a name hit; one below is not', () => {
    expect(inNameSection([at(150), at(400)], chats, [at(300)])).toEqual([0])
  })

  test('with no header below, every match under Chats is a name hit', () => {
    expect(inNameSection([at(150), at(400)], chats, [])).toEqual([0, 1])
  })

  test('a header above Chats does not bound it', () => {
    expect(inNameSection([at(150)], chats, [at(20)])).toEqual([0])
  })

  test('a match above the Chats header is not a name hit', () => {
    expect(inNameSection([at(50)], chats, [])).toEqual([])
  })
})

describe('notifyChoiceOf', () => {
  test('generic on is any activity, whatever atmention is', () => {
    expect(notifyChoiceOf({'0': true, '1': true})).toBe('onAnyActivity')
    expect(notifyChoiceOf({'0': true, '1': false})).toBe('onAnyActivity')
  })

  test('only atmention on is when @mentioned', () => {
    expect(notifyChoiceOf({'0': false, '1': true})).toBe('onWhenAtMentioned')
  })

  test('neither on, or no settings, is never', () => {
    expect(notifyChoiceOf({'0': false, '1': false})).toBe('never')
    expect(notifyChoiceOf(undefined)).toBe('never')
    expect(notifyChoiceOf(null)).toBe('never')
  })
})

const el = (type: string, attrs: Record<string, string | number>) =>
  `<XCUIElementType${type} type="XCUIElementType${type}" ${Object.entries(attrs)
    .map(([k, v]) => `${k}="${String(v)}"`)
    .join(' ')}/>`

describe('inboxIn', () => {
  test('reads small rows, channel rows, headers named by their text, and what covers the list', () => {
    const source = [
      '<AppiumAUT>',
      el('Other', {height: 64, label: 'testuser, 3:04 PM, hi &amp; bye', name: CHAT_INBOX_ROW, y: 200}),
      el('Other', {height: 40, name: CHAT_INBOX_BIG_TEAM_HEADER, y: 300}),
      el('StaticText', {height: 20, label: 'testteam', y: 310}),
      el('StaticText', {height: 20, label: 'far away', y: 500}),
      el('Other', {height: 30, label: '# general', name: CHAT_INBOX_CHANNEL_ROW, y: 340}),
      el('Other', {height: 30, name: CHAT_INBOX_UNREAD_SHORTCUT, y: 700}),
      el('TabBar', {height: 83, label: 'Tab Bar', y: 791}),
    ].join('')
    const {covers, items, signature} = inboxIn(sourceElements(source))
    expect(items).toEqual([
      {kind: 'small', label: 'testuser, 3:04 PM, hi & bye', span: {bottom: 264, top: 200}},
      {kind: 'channel', label: '# general', span: {bottom: 370, top: 340}},
      {kind: 'header', span: {bottom: 340, top: 300}, team: 'testteam'},
    ])
    expect(covers).toEqual([
      {bottom: 730, top: 700},
      {bottom: 874, top: 791},
    ])
    expect(signature).toBe('small:testuser, 3:04 PM, hi & bye\nchannel:# general\nheader:testteam')
  })

  test('a header whose name text is not drawn has no team', () => {
    const {items} = inboxIn(sourceElements(el('Other', {height: 40, name: CHAT_INBOX_BIG_TEAM_HEADER, y: 300})))
    expect(items).toEqual([{kind: 'header', span: {bottom: 340, top: 300}, team: undefined}])
  })
})

describe('sheetItemLabels', () => {
  const app = el('Application', {height: 874, label: 'Keybase', y: 0})
  test('lists the visible labelled items inside the sheet, and none of what it covers', () => {
    const source = [
      app,
      el('Other', {height: 40, label: 'a row behind', visible: 'true', y: 200}),
      el('Other', {height: 500, label: 'Bottom Sheet', visible: 'true', y: 400}),
      el('Other', {height: 40, label: '\ue900, Edit', visible: 'true', y: 450}),
      el('Other', {height: 40, label: 'Reply', visible: 'false', y: 500}),
      el('StaticText', {height: 20, label: 'Edit', visible: 'true', y: 460}),
      el('Other', {height: 40, label: 'Close', visible: 'true', y: 860}),
    ].join('')
    expect(sheetItemLabels(sourceElements(source))).toEqual(['\ue900, Edit'])
  })

  test('undefined while no sheet is visible', () => {
    expect(sheetItemLabels(sourceElements(app))).toBeUndefined()
  })
})
