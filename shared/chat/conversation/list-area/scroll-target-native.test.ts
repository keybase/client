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
  runTable([
    ['nothing centred, nothing to do', fresh, observed(undefined), leaveAlone, fresh],
    ['a target in the rows waits for the thread to load', fresh, observed(30, true, false), leaveAlone, fresh],
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
    ['a target not yet loaded waits', fresh, observed(30, false), leaveAlone, fresh],
    [
      'a newer target not yet loaded keeps the old one on record',
      centred(30),
      observed(40, false),
      leaveAlone,
      centred(30),
    ],
    ['a loaded target is moved to and refined, and takes the end', fresh, observed(30), refine(30, true), centred(30)],
    [
      'the same target again is only refined, however the rows changed around it',
      centred(30),
      observed(30),
      refine(30, false),
      centred(30),
    ],
    [
      'a target still settling after the end was asked back is only refined, and takes the end again',
      state({lastCentered: ord(30), settlingCenter: true}),
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
      'the same target leaving the rows (a reload around it) is settled again once it is back',
      released(30),
      observed(30, false),
      leaveAlone,
      centred(30),
    ],
    ['a new target is settled even after a drag', released(30), observed(40), refine(40, true), centred(40)],
    ['a new target replaces the old one', centred(30), observed(40), refine(40, true), centred(40)],
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
      centred(30),
      {centeredOrdinal: ord(40), hasMessages: true, type: 'initialLoad'},
      leaveAlone,
      centred(30),
    ],
  ])
})

describe('the native list, in sequence', () => {
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

  const observed = (n: number | undefined, targetInData = true, loaded = true): ScrollEvent => ({
    centeredOrdinal: n === undefined ? undefined : ord(n),
    loaded,
    targetInData,
    type: 'centerTargetObserved',
  })

  test('opening on a hit: move there once loaded, refine as rows arrive, then leave it in place', () => {
    const {directives, state: end} = run([
      observed(30, true, false),
      {centeredOrdinal: ord(30), hasMessages: true, type: 'initialLoad'},
      observed(30),
      observed(30),
      {how: 'drag', type: 'userScrolled'},
      observed(30),
      observed(undefined, false),
    ])
    expect(directives).toEqual([
      leaveAlone,
      leaveAlone,
      refine(30, true),
      refine(30, false),
      stopCentering,
      // Rows arriving after a drag leave the reader where they are.
      leaveAlone,
      stopCentering,
    ])
    expect(end).toEqual(fresh)
  })

  test('a load that finishes before its target arrives moves there once it does', () => {
    const {directives} = run([
      {centeredOrdinal: ord(500), hasMessages: true, type: 'initialLoad'},
      observed(500, false),
      observed(500),
    ])
    expect(directives).toEqual([leaveAlone, leaveAlone, refine(500, true)])
  })

  test('the same hit after leaving it is moved to again', () => {
    const {directives} = run([observed(30), observed(undefined, false), observed(30)])
    expect(directives).toEqual([refine(30, true), stopCentering, refine(30, true)])
  })

  test('with the keyboard up an append re-pins; scroll to bottom ends the settling without leaving the centre', () => {
    const {directives, state: end} = run(
      [{anchorHidesNewest: true, type: 'appended'}, {type: 'scrollToBottomRequested'}],
      centred(30)
    )
    expect(directives).toEqual([pinNow, {how: 'unlessAtEnd', stopCentering: true, type: 'pinEnd'}])
    expect(end).toEqual(state({lastCentered: ord(30)}))
  })

  test('after asking for the bottom from a hit still settling, rows changing under it leave the reader there', () => {
    const {directives} = run([observed(30), {type: 'scrollToBottomRequested'}, observed(30)])
    expect(directives).toEqual([
      refine(30, true),
      {how: 'unlessAtEnd', stopCentering: true, type: 'pinEnd'},
      leaveAlone,
    ])
  })
})
