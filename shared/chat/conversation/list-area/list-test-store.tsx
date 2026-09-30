// Test support for the scroll-target decision tests: the thread's transitions, and a driver that
// feeds the decisions from them the way a list adapter does.
import * as T from '@/constants/types'
import {makeScrollTarget, type ScrollDirective, type ScrollEvent} from './scroll-target'

export const range = (from: number, to: number) => {
  const out: Array<number> = []
  for (let i = from; i <= to; i++) out.push(i)
  return out.map(T.Chat.numberToOrdinal)
}

// The part of the thread store the lists read, moved the way the thread's own actions move it.
// thread-transitions.test.tsx checks each transition against the real thread store, so decision tests
// built on these only reach states the thread can actually be in.
export type ThreadSnapshot = {
  clearVersion: number
  loaded: boolean
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal> | undefined
}

export const emptyThread: ThreadSnapshot = {clearVersion: 0, loaded: false, messageOrdinals: undefined}

const mergeOrdinals = (a: ReadonlyArray<T.Chat.Ordinal> | undefined, b: ReadonlyArray<T.Chat.Ordinal>) =>
  [...new Set([...(a ?? []), ...b])].sort((x, y) => x - y)

export const threadTransitions = {
  // messagesClear, which a centred jump (a search hit, a reply quote, the catch-up pill) and jump to
  // recent both start with: one update empties the window and marks it unloaded.
  cleared: (s: ThreadSnapshot): ThreadSnapshot => ({
    clearVersion: s.clearVersion + 1,
    loaded: false,
    messageOrdinals: undefined,
  }),
  // applyThreadLoad landing a page: first load, the reload after a clear, or paging either way.
  loaded: (s: ThreadSnapshot, ordinals: ReadonlyArray<T.Chat.Ordinal>): ThreadSnapshot => ({
    ...s,
    loaded: true,
    messageOrdinals: mergeOrdinals(s.messageOrdinals, ordinals),
  }),
  // A new message arriving by notification into a window that reaches the newest message.
  received: (s: ThreadSnapshot, ordinal: T.Chat.Ordinal): ThreadSnapshot => ({
    ...s,
    messageOrdinals: mergeOrdinals(s.messageOrdinals, [ordinal]),
  }),
  // A message arriving between a clear and its reload: it is not placed, but the window it was
  // weighed against is left empty rather than absent.
  receivedDuringReload: (s: ThreadSnapshot): ThreadSnapshot => ({...s, messageOrdinals: s.messageOrdinals ?? []}),
}

// Drives decideScroll the way a list adapter does, from real thread transitions: a new clearVersion
// is a new dataset, reported before the thread is observed, and each thread or centre change is
// observed once.
export const makeScrollDriver = () => {
  let thread = emptyThread
  let centre: T.Chat.Ordinal | undefined
  const target = makeScrollTarget()
  let directives: Array<ScrollDirective> = []
  const send = (event: ScrollEvent) => {
    directives.push(target.decide(event))
  }
  const commit = (next: ThreadSnapshot, nextCentre: T.Chat.Ordinal | undefined, atNewest = false) => {
    if (next.clearVersion !== thread.clearVersion) send({type: 'datasetChanged'})
    thread = next
    centre = nextCentre
    send({
      atNewest: () => atNewest,
      centeredOrdinal: centre,
      loaded: thread.loaded,
      targetInData: centre !== undefined && !!thread.messageOrdinals?.includes(centre),
      type: 'threadObserved',
    })
  }
  return {
    // Centre context and thread together, as the app moves them.
    centreOn: (n: T.Chat.Ordinal) => commit(threadTransitions.cleared(thread), n),
    // atNewest: the list rests at its end with the newest message loaded as the centre clears.
    clearCentre: (atNewest = false) => commit(thread, undefined, atNewest),
    jumpToRecent: () => commit(threadTransitions.cleared(thread), undefined),
    load: (ordinals: ReadonlyArray<T.Chat.Ordinal>) => commit(threadTransitions.loaded(thread, ordinals), centre),
    receive: (ordinal: T.Chat.Ordinal) => commit(threadTransitions.received(thread, ordinal), centre),
    // The composer, the keyboard or jump to recent asking for the newest messages.
    requestBottom: () => send({centeredOrdinal: centre, type: 'scrollToBottomRequested'}),
    send,
    get centre() {
      return centre
    },
    get state() {
      return target.state
    },
    get thread() {
      return thread
    },
    // The directives since the last take.
    take: () => {
      const taken = directives
      directives = []
      return taken
    },
  }
}
