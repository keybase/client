/// <reference types="jest" />
import * as T from '@/constants/types'
import {
  decideScroll,
  indexOfOrdinal,
  initialScrollTarget,
  initialScrollTargetState,
  listAnchorsEnd,
  ownsEnd,
  type ScrollDirective,
  type ScrollEvent,
  type ScrollTargetState,
} from './scroll-target'

const ord = T.Chat.numberToOrdinal

const fresh = initialScrollTargetState
const state = (p: Partial<ScrollTargetState> = {}): ScrollTargetState => ({...fresh, ...p})
// Everything a busy session accumulates: reader holds the end, a target centred, a header measured,
// an edit revealed.
const busy = state({endOwner: 'reader', headerSize: 100, lastCentered: ord(30), lastEditing: ord(15)})

const leaveAlone: ScrollDirective = {stopCentering: false, type: 'leaveAlone'}
const stopCentering: ScrollDirective = {stopCentering: true, type: 'leaveAlone'}
const pinNow: ScrollDirective = {how: 'now', stopCentering: false, type: 'pinEnd'}
const pinNowStopCentering: ScrollDirective = {how: 'now', stopCentering: true, type: 'pinEnd'}
const pinUnlessAtEnd: ScrollDirective = {how: 'unlessAtEnd', stopCentering: false, type: 'pinEnd'}
const pinWhenSettled: ScrollDirective = {how: 'whenSettled', stopCentering: false, type: 'pinEnd'}
const center = (n: number): ScrollDirective => ({ordinal: ord(n), type: 'center'})
const reveal = (n: number): ScrollDirective => ({ordinal: ord(n), type: 'reveal'})

type Row = [
  name: string,
  before: ScrollTargetState,
  event: ScrollEvent,
  directive: ScrollDirective,
  after: ScrollTargetState,
]

const runTable = (rows: Array<Row>) =>
  test.each(rows)('%s', (_name, before, event, directive, after) => {
    // Frozen so a decision that mutates its input fails loudly.
    const decision = decideScroll(Object.freeze({...before}), event)
    expect(decision.directive).toEqual(directive)
    expect(decision.state).toEqual(after)
  })

describe('initial state', () => {
  test('the list owns the end and nothing is centred, measured or revealed', () => {
    expect(fresh).toEqual({
      endOwner: 'list',
      headerSize: undefined,
      lastCentered: undefined,
      lastEditing: undefined,
      settlingCenter: false,
    })
    expect(ownsEnd(fresh)).toBe(true)
    expect(ownsEnd(state({endOwner: 'reader'}))).toBe(false)
  })
})

describe('datasetChanged', () => {
  const next = {type: 'datasetChanged'} as const
  runTable([
    ['from a fresh state, nothing changes', fresh, next, leaveAlone, fresh],
    [
      'hands the end back and forgets the centred target and header, keeping the revealed edit',
      busy,
      next,
      leaveAlone,
      state({lastEditing: ord(15)}),
    ],
    ['does not stop centring already under way', state({lastCentered: ord(30)}), next, leaveAlone, fresh],
  ])
})

describe('threadObserved', () => {
  const observed = (
    p: Partial<Extract<ScrollEvent, {type: 'threadObserved'}>>
  ): Extract<ScrollEvent, {type: 'threadObserved'}> => ({
    centeredOrdinal: undefined,
    containsLatestMessage: true,
    loaded: true,
    targetInData: false,
    type: 'threadObserved',
    ...p,
  })
  runTable([
    [
      'nothing happens before the thread loads, even with the target in hand',
      fresh,
      observed({centeredOrdinal: ord(30), loaded: false, targetInData: true}),
      leaveAlone,
      fresh,
    ],
    [
      'nor does leaving a centred target before the thread loads',
      state({endOwner: 'reader', lastCentered: ord(30)}),
      observed({loaded: false}),
      leaveAlone,
      state({endOwner: 'reader', lastCentered: ord(30)}),
    ],
    [
      'a target not yet loaded waits',
      fresh,
      observed({centeredOrdinal: ord(30)}),
      leaveAlone,
      fresh,
    ],
    [
      'a loaded target is centred and takes the end from the list',
      fresh,
      observed({centeredOrdinal: ord(30), targetInData: true}),
      center(30),
      state({endOwner: 'reader', lastCentered: ord(30), settlingCenter: true}),
    ],
    [
      'centring does not depend on the newest messages being loaded',
      fresh,
      observed({centeredOrdinal: ord(30), containsLatestMessage: false, targetInData: true}),
      center(30),
      state({endOwner: 'reader', lastCentered: ord(30), settlingCenter: true}),
    ],
    [
      'the same target is centred once, however the thread changes around it',
      state({endOwner: 'reader', lastCentered: ord(30)}),
      observed({centeredOrdinal: ord(30), targetInData: true}),
      leaveAlone,
      state({endOwner: 'reader', lastCentered: ord(30)}),
    ],
    [
      'the same target is centred once even after the end was asked back',
      state({lastCentered: ord(30)}),
      observed({centeredOrdinal: ord(30), targetInData: true}),
      leaveAlone,
      state({lastCentered: ord(30)}),
    ],
    [
      'a new target replaces the old one',
      state({endOwner: 'reader', lastCentered: ord(30)}),
      observed({centeredOrdinal: ord(40), targetInData: true}),
      center(40),
      state({endOwner: 'reader', lastCentered: ord(40), settlingCenter: true}),
    ],
    [
      'a new target not yet loaded keeps the old one on record',
      state({endOwner: 'reader', lastCentered: ord(30)}),
      observed({centeredOrdinal: ord(40)}),
      leaveAlone,
      state({endOwner: 'reader', lastCentered: ord(30)}),
    ],
    [
      'centring takes the end even from a list that owned it',
      state({headerSize: 100}),
      observed({centeredOrdinal: ord(30), targetInData: true}),
      center(30),
      state({endOwner: 'reader', headerSize: 100, lastCentered: ord(30), settlingCenter: true}),
    ],
    [
      'leaving a centred target returns to the end and stops centring',
      state({endOwner: 'reader', lastCentered: ord(30)}),
      observed({}),
      pinNowStopCentering,
      fresh,
    ],
    [
      'leaving a centred target without the newest loaded hands back the end without scrolling',
      state({endOwner: 'reader', lastCentered: ord(30)}),
      observed({containsLatestMessage: false}),
      stopCentering,
      fresh,
    ],
    [
      'with nothing centred there is nothing to leave, and a reader keeps the end',
      state({endOwner: 'reader'}),
      observed({}),
      leaveAlone,
      state({endOwner: 'reader'}),
    ],
    [
      'with nothing centred and the list at the end, nothing happens',
      fresh,
      observed({containsLatestMessage: false}),
      leaveAlone,
      fresh,
    ],
  ])
})

describe('initialLoad', () => {
  runTable([
    [
      'a centred conversation centres, even before the target is known to be loaded',
      fresh,
      {centeredOrdinal: ord(30), hasMessages: true, type: 'initialLoad'},
      center(30),
      state({endOwner: 'reader', lastCentered: ord(30), settlingCenter: true}),
    ],
    [
      'a centred conversation centres even with no messages',
      fresh,
      {centeredOrdinal: ord(30), hasMessages: false, type: 'initialLoad'},
      center(30),
      state({endOwner: 'reader', lastCentered: ord(30), settlingCenter: true}),
    ],
    [
      'otherwise it goes to the end',
      fresh,
      {centeredOrdinal: undefined, hasMessages: true, type: 'initialLoad'},
      pinNow,
      fresh,
    ],
    [
      'an empty conversation has no end to go to',
      fresh,
      {centeredOrdinal: undefined, hasMessages: false, type: 'initialLoad'},
      leaveAlone,
      fresh,
    ],
    [
      'going to the end does not take it back from a reader',
      state({endOwner: 'reader'}),
      {centeredOrdinal: undefined, hasMessages: true, type: 'initialLoad'},
      pinNow,
      state({endOwner: 'reader'}),
    ],
  ])
})

describe('userScrolled', () => {
  const rows: Array<Row> = []
  for (const before of [fresh, busy]) {
    const label = before === fresh ? 'list-owned' : 'reader-owned'
    rows.push(
      [`${label}: a wheel takes the end and stops centring`, before, {how: 'wheel', type: 'userScrolled'}, stopCentering, {...before, endOwner: 'reader'}],
      [`${label}: a drag takes the end and stops centring`, before, {how: 'drag', type: 'userScrolled'}, stopCentering, {...before, endOwner: 'reader'}],
      [`${label}: paging up takes the end but lets centring finish`, before, {how: 'pageUp', type: 'userScrolled'}, leaveAlone, {...before, endOwner: 'reader'}],
      [`${label}: paging down changes nothing`, before, {how: 'pageDown', type: 'userScrolled'}, leaveAlone, before]
    )
  }
  const settling = state({endOwner: 'reader', lastCentered: ord(30), settlingCenter: true})
  rows.push(
    ['a wheel ends the settling of a centred target', settling, {how: 'wheel', type: 'userScrolled'}, stopCentering, {...settling, settlingCenter: false}],
    ['a drag ends the settling of a centred target', settling, {how: 'drag', type: 'userScrolled'}, stopCentering, {...settling, settlingCenter: false}],
    ['paging up lets a centred target keep settling', settling, {how: 'pageUp', type: 'userScrolled'}, leaveAlone, settling]
  )
  runTable(rows)
})

describe('headerMeasured', () => {
  const measured = (size: number, hasMessages = true): ScrollEvent => ({hasMessages, size, type: 'headerMeasured'})
  runTable([
    ['the first size is a baseline', fresh, measured(100), leaveAlone, state({headerSize: 100})],
    [
      'the first size is a baseline even for a reader',
      state({endOwner: 'reader'}),
      measured(100),
      leaveAlone,
      state({endOwner: 'reader', headerSize: 100}),
    ],
    ['an unchanged size is not growth', state({headerSize: 100}), measured(100), leaveAlone, state({headerSize: 100})],
    ['growth re-pins the end once the list settles', state({headerSize: 100}), measured(152), pinWhenSettled, state({headerSize: 152})],
    ['so does shrinking', state({headerSize: 152}), measured(100), pinWhenSettled, state({headerSize: 100})],
    [
      'growth is recorded but ignored once the reader owns the end',
      state({endOwner: 'reader', headerSize: 100}),
      measured(152),
      leaveAlone,
      state({endOwner: 'reader', headerSize: 152}),
    ],
    [
      'growth is recorded but ignored while the thread is empty',
      state({headerSize: 100}),
      measured(152, false),
      leaveAlone,
      state({headerSize: 152}),
    ],
    [
      'growth does not depend on a centred target, only on who owns the end',
      state({headerSize: 100, lastCentered: ord(30)}),
      measured(152),
      pinWhenSettled,
      state({headerSize: 152, lastCentered: ord(30)}),
    ],
  ])
})

describe('appended', () => {
  runTable([
    ['an anchor that keeps the newest in view is left to it', fresh, {anchorHidesNewest: false, type: 'appended'}, leaveAlone, fresh],
    ['an anchor that would hide the newest is overridden', fresh, {anchorHidesNewest: true, type: 'appended'}, pinNow, fresh],
    [
      'the override applies whoever owns the end',
      state({endOwner: 'reader'}),
      {anchorHidesNewest: true, type: 'appended'},
      pinNow,
      state({endOwner: 'reader'}),
    ],
  ])
})

describe('editingChanged', () => {
  const editing = (n: number | undefined, targetInData = true): ScrollEvent => ({
    ordinal: n === undefined ? undefined : ord(n),
    targetInData,
    type: 'editingChanged',
  })
  runTable([
    ['a loaded edit is revealed', fresh, editing(15), reveal(15), state({lastEditing: ord(15)})],
    [
      'revealing leaves the end with whoever owns it',
      state({endOwner: 'reader'}),
      editing(15),
      reveal(15),
      state({endOwner: 'reader', lastEditing: ord(15)}),
    ],
    ['the same edit is revealed once', state({lastEditing: ord(15)}), editing(15), leaveAlone, state({lastEditing: ord(15)})],
    ['a different edit is revealed', state({lastEditing: ord(15)}), editing(20), reveal(20), state({lastEditing: ord(20)})],
    [
      'an edit that is not loaded is recorded, so it is never revealed later',
      fresh,
      editing(15, false),
      leaveAlone,
      state({lastEditing: ord(15)}),
    ],
    ['stopping an edit is recorded and does not scroll', state({lastEditing: ord(15)}), editing(undefined), leaveAlone, fresh],
    ['ordinal 0 counts as no edit', fresh, editing(0), leaveAlone, state({lastEditing: ord(0)})],
  ])
})

describe('scrollToBottomRequested', () => {
  const requested = {type: 'scrollToBottomRequested'} as const
  runTable([
    ['from a reader takes back the end', busy, requested, pinUnlessAtEnd, {...busy, endOwner: 'list'}],
    ['with the list at the end changes nothing but asks again', fresh, requested, pinUnlessAtEnd, fresh],
    [
      'does not stop centring or forget the target',
      state({endOwner: 'reader', lastCentered: ord(30)}),
      requested,
      pinUnlessAtEnd,
      state({lastCentered: ord(30)}),
    ],
  ])
})

describe('sequences', () => {
  const run = (events: Array<ScrollEvent>, from = fresh) => {
    let s = from
    const directives: Array<ScrollDirective> = []
    for (const e of events) {
      const d = decideScroll(s, e)
      s = d.state
      directives.push(d.directive)
    }
    return {directives, state: s}
  }
  const observed = (centeredOrdinal: number | undefined, targetInData = true): ScrollEvent => ({
    centeredOrdinal: centeredOrdinal === undefined ? undefined : ord(centeredOrdinal),
    containsLatestMessage: true,
    loaded: true,
    targetInData,
    type: 'threadObserved',
  })
  const header = (size: number): ScrollEvent => ({hasMessages: true, size, type: 'headerMeasured'})

  test('a search hit: clear, reload, centre once, then back to the end', () => {
    const {directives, state: end} = run([
      observed(30),
      {type: 'datasetChanged'},
      observed(30, false),
      observed(30),
      observed(30),
      header(100),
      header(152),
      observed(undefined),
      header(200),
    ])
    expect(directives).toEqual([
      center(30),
      leaveAlone,
      leaveAlone,
      center(30),
      leaveAlone,
      leaveAlone,
      leaveAlone,
      pinNowStopCentering,
      pinWhenSettled,
    ])
    expect(end).toEqual(state({headerSize: 200}))
  })

  test('a wheel stops the header re-pin until the reader asks for the bottom', () => {
    const {directives} = run([
      header(100),
      {how: 'wheel', type: 'userScrolled'},
      header(152),
      {type: 'scrollToBottomRequested'},
      header(200),
    ])
    expect(directives).toEqual([leaveAlone, stopCentering, leaveAlone, pinUnlessAtEnd, pinWhenSettled])
  })

  test('jump to recent from a hit: pin first, then leaving the centre stops centring', () => {
    const {directives, state: end} = run([observed(30), {type: 'scrollToBottomRequested'}, observed(undefined)])
    expect(directives).toEqual([center(30), pinUnlessAtEnd, pinNowStopCentering])
    expect(end).toEqual(fresh)
  })

  test('an edit revealed before a reload is not revealed again after it', () => {
    const {directives} = run([
      {ordinal: ord(15), targetInData: true, type: 'editingChanged'},
      {type: 'datasetChanged'},
      {ordinal: ord(15), targetInData: true, type: 'editingChanged'},
    ])
    expect(directives).toEqual([reveal(15), leaveAlone, leaveAlone])
  })
})

describe('helpers', () => {
  const ordinals = [1, 2, 5, 9].map(ord)

  test('indexOfOrdinal finds loaded ordinals and reports -1 otherwise', () => {
    expect(indexOfOrdinal(ordinals, ord(5))).toBe(2)
    expect(indexOfOrdinal(ordinals, ord(4))).toBe(-1)
    expect(indexOfOrdinal([], ord(4))).toBe(-1)
  })

  test('initialScrollTarget starts on a loaded centred target, at the middle of the viewport', () => {
    expect(initialScrollTarget(ordinals, ord(9))).toEqual({index: 3, viewPosition: 0.5})
  })

  test('initialScrollTarget starts at the end without a target, or when the target is not loaded', () => {
    expect(initialScrollTarget(ordinals, undefined)).toBeUndefined()
    expect(initialScrollTarget(ordinals, ord(4))).toBeUndefined()
  })

  test('the list anchors the end only while nothing is centred', () => {
    expect(listAnchorsEnd(undefined)).toBe(true)
    expect(listAnchorsEnd(ord(30))).toBe(false)
  })
})
