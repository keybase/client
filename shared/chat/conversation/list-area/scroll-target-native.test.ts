/// <reference types="jest" />
// The scroll-target events only the native list reports, and how its first load and appends read
// through the shared ones.
import * as T from '@/constants/types'
import {
  decideScroll,
  initialScrollTargetState,
  type ScrollDirective,
  type ScrollEvent,
  type ScrollTargetState,
} from './scroll-target'
import {makeScrollDriver} from './list-test-store'

const ord = T.Chat.numberToOrdinal

const fresh = initialScrollTargetState
const state = (p: Partial<ScrollTargetState> = {}): ScrollTargetState => ({...fresh, ...p})
const centred = (n: number) => state({endOwner: 'reader', lastCentered: ord(n), settlingCenter: true})
// Centred, and then the reader dragged away from it.
const released = (n: number) => state({endOwner: 'reader', lastCentered: ord(n)})

const leaveAlone: ScrollDirective = {stopCentering: false, type: 'leaveAlone'}
const stopCentering: ScrollDirective = {stopCentering: true, type: 'leaveAlone'}
const pinNow: ScrollDirective = {how: 'now', stopCentering: false, type: 'pinEnd'}
const refine = (n: number, newTarget: boolean): ScrollDirective => ({
  newTarget,
  ordinal: ord(n),
  type: 'refineCenter',
})

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

describe('centerTargetObserved', () => {
  const observed = (n: number | undefined, targetInData = true, loaded = true): ScrollEvent => ({
    centeredOrdinal: n === undefined ? undefined : ord(n),
    loaded,
    targetInData,
    type: 'centerTargetObserved',
  })
  // A centre is only ever set together with a clear (centerOnMessage reloads around its target), so
  // a new target arrives with an unloaded, empty thread, and the only way to a target is through a
  // load that brings it.
  runTable([
    ['nothing centred, nothing to do', fresh, observed(undefined), leaveAlone, fresh],
    ['a target waits for the reload that brings it', fresh, observed(30, false, false), leaveAlone, fresh],
    [
      'leaving a centred target does not wait for the load',
      centred(30),
      observed(undefined, false, false),
      stopCentering,
      fresh,
    ],
    [
      'nothing centred leaves a reader holding the end',
      state({endOwner: 'reader'}),
      observed(undefined),
      leaveAlone,
      state({endOwner: 'reader'}),
    ],
    ['a target the load did not bring waits', fresh, observed(30, false), leaveAlone, fresh],
    ['a loaded target is moved to and refined, and takes the end', fresh, observed(30), refine(30, true), centred(30)],
    [
      'the same target again is only refined, however the rows changed around it',
      centred(30),
      observed(30),
      refine(30, false),
      centred(30),
    ],
    [
      'once the reader has dragged away, rows changing under the same target leave them there',
      released(30),
      observed(30),
      leaveAlone,
      released(30),
    ],
    [
      'leaving a centred target stops centring and leaves the reader where they are',
      centred(30),
      observed(undefined),
      stopCentering,
      fresh,
    ],
    [
      'leaving keeps the rest of the state',
      state({endOwner: 'reader', headerSize: 100, lastCentered: ord(30), lastEditing: ord(15)}),
      observed(undefined),
      stopCentering,
      state({headerSize: 100, lastEditing: ord(15)}),
    ],
  ])
})

describe('initialLoad', () => {
  runTable([
    [
      'a centred load leaves the target to the centre reconcile',
      fresh,
      {centeredOrdinal: ord(30), hasMessages: true, type: 'initialLoad'},
      leaveAlone,
      fresh,
    ],
  ])
})

describe('the native list, in sequence', () => {
  const window = (from: number, to: number) => {
    const out: Array<T.Chat.Ordinal> = []
    for (let i = from; i <= to; i++) out.push(ord(i))
    return out
  }
  const driver = () =>
    makeScrollDriver({
      observe: (thread, centre) => ({
        centeredOrdinal: centre,
        loaded: thread.loaded,
        targetInData: centre !== undefined && !!thread.messageOrdinals?.includes(centre),
        type: 'centerTargetObserved',
      }),
      reportsDatasets: false,
    })
  const nativeList = () => {
    const d = driver()
    // A conversation already open at its newest messages.
    d.load(window(1, 60))
    d.take()
    return d
  }
  const bottomRequested = {how: 'unlessAtEnd', stopCentering: true, type: 'pinEnd'} as const

  test('a search hit: move there once it loads, refine as rows arrive, then leave it in place', () => {
    const d = nativeList()
    d.centreOn(ord(500))
    d.load(window(450, 550))
    d.load(window(400, 449))
    d.send({how: 'drag', type: 'userScrolled'})
    d.load(window(350, 399))
    d.clearCentre()
    expect(d.take()).toEqual([
      leaveAlone,
      refine(500, true),
      refine(500, false),
      stopCentering,
      // Rows arriving after a drag leave the reader where they are.
      leaveAlone,
      stopCentering,
    ])
    expect(d.state).toEqual(fresh)
  })

  test('opening a conversation on a hit leaves the first load to the centre reconcile', () => {
    const d = driver()
    d.centreOn(ord(30))
    d.send({centeredOrdinal: ord(30), hasMessages: true, type: 'initialLoad'})
    d.load(window(1, 60))
    expect(d.take()).toEqual([leaveAlone, leaveAlone, refine(30, true)])
  })

  test('the same hit after closing it is moved to again', () => {
    const d = nativeList()
    d.centreOn(ord(30))
    d.load(window(1, 60))
    d.clearCentre()
    d.centreOn(ord(30))
    d.load(window(1, 60))
    expect(d.take()).toEqual([leaveAlone, refine(30, true), stopCentering, leaveAlone, refine(30, true)])
  })

  test('with the keyboard up a new message re-pins; scroll to bottom ends the settling without leaving the centre', () => {
    const d = nativeList()
    d.centreOn(ord(30))
    d.load(window(1, 60))
    d.take()
    d.receive(ord(61))
    d.send({anchorHidesNewest: true, type: 'appended'})
    d.send({type: 'scrollToBottomRequested'})
    expect(d.take()).toEqual([refine(30, false), pinNow, bottomRequested])
    expect(d.state).toEqual(state({lastCentered: ord(30)}))
  })

  test('after asking for the bottom from a hit still settling, a new message leaves the reader there', () => {
    const d = nativeList()
    d.centreOn(ord(30))
    d.load(window(1, 60))
    d.send({type: 'scrollToBottomRequested'})
    d.receive(ord(61))
    expect(d.take()).toEqual([leaveAlone, refine(30, true), bottomRequested, leaveAlone])
  })
})
