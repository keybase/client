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
const center = (n: number): ScrollDirective => ({ordinal: ord(n), type: 'center'})
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
  const observed = (n: number | undefined, targetInData = true): ScrollEvent => ({
    centeredOrdinal: n === undefined ? undefined : ord(n),
    targetInData,
    type: 'centerTargetObserved',
  })
  runTable([
    ['nothing centred, nothing to do', fresh, observed(undefined), leaveAlone, fresh],
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

describe('centerRequested', () => {
  const requested = (n: number | undefined): ScrollEvent => ({
    centeredOrdinal: n === undefined ? undefined : ord(n),
    type: 'centerRequested',
  })
  runTable([
    ['a target is centred, loaded or not', fresh, requested(30), center(30), centred(30)],
    ['a target already centred is left alone', centred(30), requested(30), leaveAlone, centred(30)],
    ['a new target replaces the old one', centred(30), requested(500), center(500), centred(500)],
    ['no target, nothing to do', centred(30), requested(undefined), leaveAlone, centred(30)],
  ])
})

describe('initialLoad', () => {
  runTable([
    [
      'a target already centred before the load finished is not centred again',
      centred(30),
      {centeredOrdinal: ord(30), hasMessages: true, type: 'initialLoad'},
      leaveAlone,
      centred(30),
    ],
    [
      'a target other than the one centred is',
      centred(30),
      {centeredOrdinal: ord(40), hasMessages: true, type: 'initialLoad'},
      center(40),
      centred(40),
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

  test('opening on a hit: move there on load, refine as rows arrive, then leave it in place', () => {
    const {directives, state: end} = run([
      {centeredOrdinal: ord(30), targetInData: true, type: 'centerTargetObserved'},
      {centeredOrdinal: ord(30), hasMessages: true, type: 'initialLoad'},
      {centeredOrdinal: ord(30), type: 'centerRequested'},
      {centeredOrdinal: ord(30), targetInData: true, type: 'centerTargetObserved'},
      {how: 'drag', type: 'userScrolled'},
      {centeredOrdinal: ord(30), targetInData: true, type: 'centerTargetObserved'},
      {centeredOrdinal: undefined, targetInData: false, type: 'centerTargetObserved'},
    ])
    expect(directives).toEqual([
      refine(30, true),
      leaveAlone,
      leaveAlone,
      refine(30, false),
      stopCentering,
      // Rows arriving after a drag leave the reader where they are.
      leaveAlone,
      stopCentering,
    ])
    expect(end).toEqual(fresh)
  })

  test('a load that finishes before its target arrives moves there first and only refines later', () => {
    const {directives} = run([
      {centeredOrdinal: ord(500), hasMessages: true, type: 'initialLoad'},
      {centeredOrdinal: ord(500), targetInData: false, type: 'centerTargetObserved'},
      {centeredOrdinal: ord(500), targetInData: true, type: 'centerTargetObserved'},
    ])
    expect(directives).toEqual([center(500), leaveAlone, refine(500, false)])
  })

  test('the same hit after leaving it is moved to again', () => {
    const {directives} = run([
      {centeredOrdinal: ord(30), targetInData: true, type: 'centerTargetObserved'},
      {centeredOrdinal: undefined, targetInData: false, type: 'centerTargetObserved'},
      {centeredOrdinal: ord(30), targetInData: true, type: 'centerTargetObserved'},
    ])
    expect(directives).toEqual([refine(30, true), stopCentering, refine(30, true)])
  })

  test('with the keyboard up an append re-pins; scroll to bottom pins without leaving the centre', () => {
    const {directives, state: end} = run(
      [{anchorHidesNewest: true, type: 'appended'}, {type: 'scrollToBottomRequested'}],
      centred(30)
    )
    expect(directives).toEqual([pinNow, {how: 'unlessAtEnd', stopCentering: false, type: 'pinEnd'}])
    expect(end).toEqual(state({lastCentered: ord(30), settlingCenter: true}))
  })
})
