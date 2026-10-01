/// <reference types="jest" />
import * as T from '@/constants/types'
import {
  decideScroll,
  indexOfOrdinal,
  indexOfOrdinalNewestFirst,
  initialScrollTarget,
  initialScrollTargetState,
  listAnchorsEnd,
  makeScrollTarget,
  ownsEnd,
  type ScrollDirective,
  type ScrollEvent,
  type ScrollTargetState,
} from './scroll-target'
import {makeScrollDriver} from './thread-test-driver'

const ord = T.Chat.numberToOrdinal

const fresh = initialScrollTargetState
const state = (p: Partial<ScrollTargetState> = {}): ScrollTargetState => ({...fresh, ...p})
// Everything a busy session accumulates: reader holds the end, a target centred, a header measured,
// an edit revealed.
const busy = state({endOwner: 'reader', headerSize: 100, lastCentered: ord(30), lastEditing: ord(15)})
const centred = (n: number) => state({endOwner: 'reader', lastCentered: ord(n), settlingCenter: true})
// Centred, and then settled or left by the reader.
const released = (n: number) => state({endOwner: 'reader', lastCentered: ord(n)})

const leaveAlone: ScrollDirective = {stopCentering: false, type: 'leaveAlone'}
const stopCentering: ScrollDirective = {stopCentering: true, type: 'leaveAlone'}
const pinEnd: ScrollDirective = {retry: false, stopCentering: false, type: 'pinEnd', verify: false}
const pinEndStopCentering: ScrollDirective = {...pinEnd, stopCentering: true}
// The end moved with a size change: confirm it held once the list settles.
const verifyEnd: ScrollDirective = {...pinEnd, verify: true}
// The first load's pin, which asks for the first load to be reported again.
const pinEndRetry: ScrollDirective = {...pinEnd, retry: true}
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
      holdingEdit: false,
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
    ['from a fresh state, only stops any centring', fresh, next, stopCentering, fresh],
    [
      'hands the end back and forgets the centred target, keeping the header size and the revealed edit',
      busy,
      next,
      stopCentering,
      state({headerSize: 100, lastEditing: ord(15)}),
    ],
    [
      'stops centring already under way',
      state({lastCentered: ord(30), settlingCenter: true}),
      next,
      stopCentering,
      fresh,
    ],
    ['ends the hold on a revealed edit', state({endOwner: 'reader', holdingEdit: true, lastEditing: ord(15)}), next, stopCentering, state({lastEditing: ord(15)})],
  ])
})

describe('threadObserved', () => {
  const observed = (n: number | undefined, targetInData = true, loaded = true, atNewest = false): ScrollEvent => ({
    atNewest: () => atNewest,
    centeredOrdinal: n === undefined ? undefined : ord(n),
    loaded,
    targetInData,
    type: 'threadObserved',
  })
  // A centre is only ever set together with a clear (centerOnMessage reloads around its target), so
  // a new target arrives with an unloaded, empty thread, and the only way to a target is through a
  // load that brings it.
  runTable([
    ['nothing centred, nothing to do', fresh, observed(undefined), leaveAlone, fresh],
    [
      'a target waits for the reload that brings it, and takes the end from the list meanwhile',
      fresh,
      observed(30, false, false),
      leaveAlone,
      state({endOwner: 'reader'}),
    ],
    [
      'a target the load did not bring waits, holding the end',
      fresh,
      observed(30, false),
      leaveAlone,
      state({endOwner: 'reader'}),
    ],
    [
      'a target the reader asked the bottom over waits without taking the end back',
      state({lastCentered: ord(30)}),
      observed(30, false, false),
      leaveAlone,
      state({lastCentered: ord(30)}),
    ],
    ['a loaded target is centred and takes the end from the list', fresh, observed(30), center(30), centred(30)],
    [
      'centring ends the hold on a revealed edit',
      state({endOwner: 'reader', holdingEdit: true, lastEditing: ord(15)}),
      observed(30),
      center(30),
      {...centred(30), lastEditing: ord(15)},
    ],
    [
      'centring takes the end even from a list that owned it, keeping the rest',
      state({headerSize: 100, lastEditing: ord(15)}),
      observed(30),
      center(30),
      {...centred(30), headerSize: 100, lastEditing: ord(15)},
    ],
    [
      'rows changing under a target still settling need no directive: its centring measures them as it goes',
      centred(30),
      observed(30),
      leaveAlone,
      centred(30),
    ],
    [
      'once it has settled or the reader left it, rows changing under the same target leave it be',
      released(30),
      observed(30),
      leaveAlone,
      released(30),
    ],
    [
      'the same target is centred once even after the end was asked back',
      state({lastCentered: ord(30)}),
      observed(30),
      leaveAlone,
      state({lastCentered: ord(30)}),
    ],
    [
      'nothing centred leaves a reader holding the end',
      state({endOwner: 'reader'}),
      observed(undefined),
      leaveAlone,
      state({endOwner: 'reader'}),
    ],
    [
      'leaving a centred target (closing thread search) stops centring and leaves the reader, and the end, where they are',
      centred(30),
      observed(undefined),
      stopCentering,
      state({endOwner: 'reader'}),
    ],
    [
      'leaving a centred target with the list resting at the newest message hands the end back to the list',
      centred(30),
      observed(undefined, false, true, true),
      stopCentering,
      fresh,
    ],
    [
      'leaving after asking for the bottom leaves the end with the list',
      state({lastCentered: ord(30)}),
      observed(undefined),
      stopCentering,
      fresh,
    ],
    [
      'leaving keeps the rest of the state',
      busy,
      observed(undefined),
      stopCentering,
      state({endOwner: 'reader', headerSize: 100, lastEditing: ord(15)}),
    ],
  ])
})

describe('centerSettled', () => {
  runTable([
    ['the target stops settling, and keeps the end and its record', centred(30), {type: 'centerSettled'}, leaveAlone, released(30)],
    ['with nothing settling, nothing changes', released(30), {type: 'centerSettled'}, leaveAlone, released(30)],
  ])
})

describe('detached', () => {
  runTable([
    [
      'a target still settling is forgotten, so the list re-attaching centres it afresh',
      centred(30),
      {type: 'detached'},
      stopCentering,
      state({endOwner: 'reader'}),
    ],
    ['a target that settled or the reader left stays centred', released(30), {type: 'detached'}, stopCentering, released(30)],
    [
      'the hold on a revealed edit ends',
      state({endOwner: 'reader', holdingEdit: true, lastEditing: ord(15)}),
      {type: 'detached'},
      stopCentering,
      state({endOwner: 'reader', lastEditing: ord(15)}),
    ],
  ])
})

describe('initialLoad', () => {
  const loaded = (hasMessages = true, retry = false): ScrollEvent => ({hasMessages, retry, type: 'initialLoad'})
  runTable([
    ['a conversation with messages goes to the end, and asks to be told again', fresh, loaded(), pinEndRetry, fresh],
    ['an empty conversation has no end to go to', fresh, loaded(false), leaveAlone, fresh],
    [
      'a centred one, whose request took the end, is left to the centre reconcile',
      state({endOwner: 'reader'}),
      loaded(),
      leaveAlone,
      state({endOwner: 'reader'}),
    ],
    ['told again, it goes to the end once more and asks no further', fresh, loaded(true, true), pinEnd, fresh],
    [
      'told again after a centre was requested in between, it leaves the list to the centre',
      state({endOwner: 'reader'}),
      loaded(true, true),
      leaveAlone,
      state({endOwner: 'reader'}),
    ],
    ['told again with the rows gone, there is no end to go to', fresh, loaded(false, true), leaveAlone, fresh],
  ])
})

describe('userScrolled', () => {
  const scrolled: ScrollEvent = {type: 'userScrolled'}
  const settling = state({endOwner: 'reader', lastCentered: ord(30), settlingCenter: true})
  runTable([
    ['takes the end from the list and stops centring', fresh, scrolled, stopCentering, state({endOwner: 'reader'})],
    ['leaves a reader holding the end with it, with nothing to stop', busy, scrolled, leaveAlone, busy],
    ['ends the settling of a centred target', settling, scrolled, stopCentering, {...settling, settlingCenter: false}],
    [
      'ends the hold on a revealed edit',
      state({endOwner: 'reader', holdingEdit: true, lastEditing: ord(15)}),
      scrolled,
      stopCentering,
      state({endOwner: 'reader', lastEditing: ord(15)}),
    ],
  ])

  // The reader's scroll arrives on every scroll event; one that changes nothing leaves the state as it is.
  test('from a reader already holding the end with nothing settling, the state is left as it is', () => {
    const holding = Object.freeze(state({endOwner: 'reader', lastCentered: ord(30)}))
    expect(decideScroll(holding, scrolled).state).toBe(holding)
  })
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
    ['growth re-pins the end once the list settles', state({headerSize: 100}), measured(152), verifyEnd, state({headerSize: 152})],
    ['so does shrinking', state({headerSize: 152}), measured(100), verifyEnd, state({headerSize: 100})],
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
      verifyEnd,
      state({headerSize: 152, lastCentered: ord(30)}),
    ],
  ])
})

describe('appended', () => {
  runTable([
    ['an anchor that keeps the newest in view is left to it', fresh, {anchorHidesNewest: false, type: 'appended'}, leaveAlone, fresh],
    ['an anchor that would hide the newest is overridden', fresh, {anchorHidesNewest: true, type: 'appended'}, pinEnd, fresh],
    [
      'a reader who scrolled away from the end is left there',
      state({endOwner: 'reader'}),
      {anchorHidesNewest: true, type: 'appended'},
      leaveAlone,
      state({endOwner: 'reader'}),
    ],
    [
      'a reader on a centred target keeps it',
      state({endOwner: 'reader', lastCentered: ord(30), settlingCenter: true}),
      {anchorHidesNewest: true, type: 'appended'},
      leaveAlone,
      state({endOwner: 'reader', lastCentered: ord(30), settlingCenter: true}),
    ],
    [
      'so does one who dragged away from it',
      state({endOwner: 'reader', lastCentered: ord(30)}),
      {anchorHidesNewest: true, type: 'appended'},
      leaveAlone,
      state({endOwner: 'reader', lastCentered: ord(30)}),
    ],
    [
      'once the reader asked for the bottom from a centred target, the override applies again',
      state({lastCentered: ord(30)}),
      {anchorHidesNewest: true, type: 'appended'},
      pinEnd,
      state({lastCentered: ord(30)}),
    ],
  ])
})

describe('viewportResized', () => {
  const resized = (anchorsEnd = true, rowFullyVisible = false): ScrollEvent => ({
    anchorsEnd,
    rowFullyVisible: () => rowFullyVisible,
    type: 'viewportResized',
  })
  const holding = state({endOwner: 'reader', holdingEdit: true, lastEditing: ord(15)})
  const holdingInView = state({holdingEdit: true, lastEditing: ord(15)})
  runTable([
    ['an end the list holds is re-pinned once the list settles', fresh, resized(), verifyEnd, fresh],
    ['an end the list owns but its anchor does not hold is left alone', fresh, resized(false), leaveAlone, fresh],
    ['a reader holding the end is left where they are', busy, resized(), leaveAlone, busy],
    ['a held reveal the change cut off is aimed again', holding, resized(), reveal(15), holding],
    ['a held reveal still wholly in view is left where it is', holding, resized(true, true), leaveAlone, holding],
    [
      'a held edit that was in view and the change cut off is revealed, which takes the end from the list',
      holdingInView,
      resized(false),
      reveal(15),
      {...holdingInView, endOwner: 'reader'},
    ],
    ['a held edit still wholly in view leaves the end the list holds to be re-pinned', holdingInView, resized(true, true), verifyEnd, holdingInView],
    [
      'a reveal no longer held is left alone',
      state({endOwner: 'reader', lastEditing: ord(15)}),
      resized(),
      leaveAlone,
      state({endOwner: 'reader', lastEditing: ord(15)}),
    ],
  ])
})

describe('rowResized', () => {
  const resized = (anchorsEnd = true): ScrollEvent => ({anchorsEnd, type: 'rowResized'})
  runTable([
    ['an end the list holds is re-pinned once the list settles', fresh, resized(), verifyEnd, fresh],
    ['an end the list owns but its anchor does not hold is left alone', fresh, resized(false), leaveAlone, fresh],
    ['a reader holding the end is left where they are', busy, resized(), leaveAlone, busy],
    ['a centred target is left to its centring', centred(30), resized(false), leaveAlone, centred(30)],
    [
      'a held reveal is left where it is',
      state({endOwner: 'reader', holdingEdit: true, lastEditing: ord(15)}),
      resized(),
      leaveAlone,
      state({endOwner: 'reader', holdingEdit: true, lastEditing: ord(15)}),
    ],
  ])
})

describe('readerAtEnd', () => {
  runTable([
    ['hands the end back to the list', busy, {type: 'readerAtEnd'}, leaveAlone, {...busy, endOwner: 'list'}],
    ['with the list at the end, changes nothing', fresh, {type: 'readerAtEnd'}, leaveAlone, fresh],
  ])
})

describe('editingChanged', () => {
  const editing = (n: number | undefined, targetInData = true, rowFullyVisible = false): ScrollEvent => ({
    ordinal: n === undefined ? undefined : ord(n),
    rowFullyVisible: () => rowFullyVisible,
    targetInData,
    type: 'editingChanged',
  })
  runTable([
    [
      'a loaded edit out of view is revealed, and the reveal takes the end from the list',
      fresh,
      editing(15),
      reveal(15),
      state({endOwner: 'reader', holdingEdit: true, lastEditing: ord(15)}),
    ],
    [
      'an edit already wholly in view is held where it is and not scrolled to, and the end stays with the list',
      fresh,
      editing(58, true, true),
      leaveAlone,
      state({holdingEdit: true, lastEditing: ord(58)}),
    ],
    [
      'a reader holding the end keeps it',
      state({endOwner: 'reader'}),
      editing(58, true, true),
      leaveAlone,
      state({endOwner: 'reader', holdingEdit: true, lastEditing: ord(58)}),
    ],
    ['the same edit is revealed once', state({lastEditing: ord(15)}), editing(15), leaveAlone, state({lastEditing: ord(15)})],
    [
      'a different edit is revealed',
      state({lastEditing: ord(15)}),
      editing(20),
      reveal(20),
      state({endOwner: 'reader', holdingEdit: true, lastEditing: ord(20)}),
    ],
    [
      'a different edit already in view is held in place of the last reveal',
      state({endOwner: 'reader', holdingEdit: true, lastEditing: ord(15)}),
      editing(20, true, true),
      leaveAlone,
      state({endOwner: 'reader', holdingEdit: true, lastEditing: ord(20)}),
    ],
    [
      'a different edit that is not loaded ends the hold on the last reveal',
      state({endOwner: 'reader', holdingEdit: true, lastEditing: ord(15)}),
      editing(20, false),
      leaveAlone,
      state({endOwner: 'reader', lastEditing: ord(15)}),
    ],
    [
      'stopping an edit ends the hold on its reveal',
      state({endOwner: 'reader', holdingEdit: true, lastEditing: ord(15)}),
      editing(undefined),
      leaveAlone,
      state({endOwner: 'reader'}),
    ],
    ['an edit that is not loaded waits, unrecorded, for its row', fresh, editing(15, false), leaveAlone, fresh],
    [
      'an edit that is not loaded leaves the last revealed one recorded',
      state({lastEditing: ord(20)}),
      editing(15, false),
      leaveAlone,
      state({lastEditing: ord(20)}),
    ],
    ['stopping an edit is recorded and does not scroll', state({lastEditing: ord(15)}), editing(undefined), leaveAlone, fresh],
    ['ordinal 0 counts as no edit', fresh, editing(0), leaveAlone, state({lastEditing: ord(0)})],
  ])
})

describe('scrollToBottomRequested', () => {
  const requested = (n?: number): ScrollEvent => ({
    centeredOrdinal: n === undefined ? undefined : ord(n),
    type: 'scrollToBottomRequested',
  })
  runTable([
    ['from a reader takes back the end', busy, requested(30), pinEndStopCentering, {...busy, endOwner: 'list'}],
    ['with the list at the end changes nothing but asks again', fresh, requested(), pinEndStopCentering, fresh],
    ['ends the hold on a revealed edit', state({endOwner: 'reader', holdingEdit: true, lastEditing: ord(15)}), requested(), pinEndStopCentering, state({lastEditing: ord(15)})],
    [
      'ends the settling of a centred target, as a drag does, but keeps the target',
      state({endOwner: 'reader', lastCentered: ord(30), settlingCenter: true}),
      requested(30),
      pinEndStopCentering,
      state({lastCentered: ord(30)}),
    ],
    [
      'counts a target still loading as centred, so its arrival leaves the reader at the bottom',
      fresh,
      requested(30),
      pinEndStopCentering,
      state({lastCentered: ord(30)}),
    ],
  ])
})

describe('sequences', () => {
  const window = (from: number, to: number) => {
    const out: Array<T.Chat.Ordinal> = []
    for (let i = from; i <= to; i++) out.push(ord(i))
    return out
  }
  // A list over a conversation already open at its newest messages.
  const openList = () => {
    const d = makeScrollDriver()
    d.send({type: 'datasetChanged'})
    d.load(window(1, 60))
    d.take()
    return d
  }
  const header = (size: number): ScrollEvent => ({hasMessages: true, size, type: 'headerMeasured'})
  const wheel: ScrollEvent = {type: 'userScrolled'}

  test('a search hit: clear, reload, centre, settle as rows arrive, then leave it in place', () => {
    const d = openList()
    d.centreOn(ord(500))
    d.load(window(450, 550))
    d.load(window(400, 449))
    d.send({type: 'centerSettled'})
    d.load(window(350, 399))
    d.send(header(100))
    d.send(header(152))
    d.clearCentre()
    d.send(header(200))
    expect(d.take()).toEqual([
      stopCentering,
      leaveAlone,
      center(500),
      leaveAlone,
      leaveAlone,
      // Rows arriving under a settled target leave the reader where they are.
      leaveAlone,
      leaveAlone,
      leaveAlone,
      stopCentering,
      leaveAlone,
    ])
    expect(d.state).toEqual(state({endOwner: 'reader', headerSize: 200}))
  })

  test('opening a conversation on a hit leaves the first load to the centre reconcile', () => {
    const d = makeScrollDriver()
    d.centreOn(ord(30))
    d.load(window(1, 60))
    d.send({hasMessages: true, retry: false, type: 'initialLoad'})
    expect(d.take()).toEqual([stopCentering, leaveAlone, center(30), leaveAlone])
  })

  test('re-choosing the same hit after wheeling away reloads it and centres it again', () => {
    const d = openList()
    d.centreOn(ord(30))
    d.load(window(1, 60))
    d.send(wheel)
    d.centreOn(ord(30))
    d.load(window(1, 60))
    expect(d.take()).toEqual([stopCentering, leaveAlone, center(30), stopCentering, stopCentering, leaveAlone, center(30)])
  })

  test('the same hit after closing it is centred again', () => {
    const d = openList()
    d.centreOn(ord(30))
    d.load(window(1, 60))
    d.clearCentre()
    d.centreOn(ord(30))
    d.load(window(1, 60))
    expect(d.take()).toEqual([stopCentering, leaveAlone, center(30), stopCentering, stopCentering, leaveAlone, center(30)])
  })

  test('a wheel stops the header re-pin until the reader asks for the bottom', () => {
    const d = openList()
    d.send(header(100))
    d.send(wheel)
    d.send(header(152))
    d.requestBottom()
    d.send(header(200))
    expect(d.take()).toEqual([leaveAlone, stopCentering, leaveAlone, pinEndStopCentering, verifyEnd])
  })

  test('jump to recent from a hit: pin first, then the clear hands the end back to the list', () => {
    const d = openList()
    d.centreOn(ord(30))
    d.load(window(1, 60))
    d.requestBottom()
    d.jumpToRecent()
    d.load(window(1, 60))
    expect(d.take()).toEqual([
      stopCentering,
      leaveAlone,
      center(30),
      pinEndStopCentering,
      stopCentering,
      leaveAlone,
      leaveAlone,
    ])
    expect(d.state).toEqual(fresh)
  })

  test('asking for the bottom before the hit loads leaves the reader at the bottom once it does', () => {
    const d = openList()
    d.centreOn(ord(30))
    d.requestBottom()
    d.load(window(1, 60))
    expect(d.take()).toEqual([stopCentering, leaveAlone, pinEndStopCentering, leaveAlone])
  })

  test('with the keyboard up a new message leaves a settling hit alone; asking for the bottom ends the settling without leaving the centre', () => {
    const d = openList()
    d.centreOn(ord(30))
    d.load(window(1, 60))
    d.take()
    d.receive(ord(61))
    d.send({anchorHidesNewest: true, type: 'appended'})
    d.requestBottom()
    expect(d.take()).toEqual([leaveAlone, leaveAlone, pinEndStopCentering])
    expect(d.state).toEqual(state({lastCentered: ord(30)}))
  })

  test('after asking for the bottom from a hit still settling, a new message leaves the reader there', () => {
    const d = openList()
    d.centreOn(ord(30))
    d.load(window(1, 60))
    d.requestBottom()
    d.receive(ord(61))
    expect(d.take()).toEqual([stopCentering, leaveAlone, center(30), pinEndStopCentering, leaveAlone])
  })

  test('an edit revealed before a reload is not revealed again after it', () => {
    const d = openList()
    d.send({ordinal: ord(15), rowFullyVisible: () => false, targetInData: true, type: 'editingChanged'})
    d.centreOn(ord(30))
    d.load(window(1, 60))
    d.send({ordinal: ord(15), rowFullyVisible: () => false, targetInData: true, type: 'editingChanged'})
    expect(d.take()).toEqual([reveal(15), stopCentering, leaveAlone, center(30), leaveAlone])
  })
})

describe('helpers', () => {
  const ordinals = [1, 2, 5, 9].map(ord)

  test('indexOfOrdinalNewestFirst finds loaded ordinals in rows held newest first and reports -1 otherwise', () => {
    const newestFirst = [...ordinals].reverse()
    ordinals.forEach(o => expect(indexOfOrdinalNewestFirst(newestFirst, o)).toBe(newestFirst.indexOf(o)))
    expect(indexOfOrdinalNewestFirst(newestFirst, ord(4))).toBe(-1)
    expect(indexOfOrdinalNewestFirst(newestFirst, ord(1000))).toBe(-1)
    expect(indexOfOrdinalNewestFirst([], ord(4))).toBe(-1)
  })

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

  test('the list anchors the end only while it owns the end, nothing is centred and the thread holds the newest message', () => {
    const anchors = {centeredOrdinal: undefined, heldLatest: true, listOwnsEnd: true}
    expect(listAnchorsEnd(anchors)).toBe(true)
    expect(listAnchorsEnd({...anchors, listOwnsEnd: false})).toBe(false)
    expect(listAnchorsEnd({...anchors, centeredOrdinal: ord(30)})).toBe(false)
    expect(listAnchorsEnd({...anchors, heldLatest: false})).toBe(false)
  })

  test('the scroll target tells its subscriber of each change to its state, and only then', () => {
    const target = makeScrollTarget()
    const heard = jest.fn()
    const unsubscribe = target.subscribe(heard)
    target.decide({type: 'userScrolled'})
    expect(heard).toHaveBeenCalledTimes(1)
    target.decide({type: 'userScrolled'})
    expect(heard).toHaveBeenCalledTimes(1)
    target.decide({type: 'readerAtEnd'})
    expect(heard).toHaveBeenCalledTimes(2)
    target.decide({
      atNewest: () => false,
      centeredOrdinal: undefined,
      loaded: true,
      targetInData: false,
      type: 'threadObserved',
    })
    expect(heard).toHaveBeenCalledTimes(2)
    unsubscribe()
    target.decide({type: 'userScrolled'})
    expect(heard).toHaveBeenCalledTimes(2)
  })

  test('unsubscribing a replaced subscriber leaves the current one subscribed', () => {
    const target = makeScrollTarget()
    const stale = jest.fn()
    const current = jest.fn()
    const unsubscribeStale = target.subscribe(stale)
    target.subscribe(current)
    unsubscribeStale()
    target.decide({type: 'userScrolled'})
    expect(stale).not.toHaveBeenCalled()
    expect(current).toHaveBeenCalledTimes(1)
  })
})
