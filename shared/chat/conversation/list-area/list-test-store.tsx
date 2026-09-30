// Test support shared by the thread list harnesses: a tiny external store the tests drive in place
// of the thread, center and input providers, and what both harnesses record and hand the tests.
import * as React from 'react'
import * as T from '@/constants/types'
import type {ThreadRefsContext} from '../normal/context'
import {makeScrollTarget, type ScrollDirective, type ScrollEvent} from './scroll-target'

export type Store<S> = {
  get: () => S
  reset: (s: S) => void
  set: (partial: Partial<S>) => void
  subscribe: (listener: () => void) => () => void
}

export const makeStore = <S extends object>(initial: S): Store<S> => {
  let state = initial
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach(l => l())
  return {
    get: () => state,
    reset: (s: S) => {
      state = s
      emit()
    },
    set: (partial: Partial<S>) => {
      state = {...state, ...partial}
      emit()
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export const useStore = <S extends object, R>(store: Store<S>, selector: (s: S) => R): R =>
  React.useSyncExternalStore(store.subscribe, () => selector(store.get()))

export const ords = (...ns: Array<number>) => ns.map(T.Chat.numberToOrdinal)
export const range = (from: number, to: number) => {
  const out: Array<number> = []
  for (let i = from; i <= to; i++) out.push(i)
  return ords(...out)
}

// Everything the list does, in the order it did it: imperative scrolls on the list handle and the
// thread and centre actions it calls, and what it tells catch-up.
export const log: Array<[string, unknown?]> = []

type CenterState = {
  centeredHighlightOrdinal: T.Chat.Ordinal | undefined
  centeredOrdinal: T.Chat.Ordinal | undefined
  hasCenter: boolean
}
const noCenter: CenterState = {centeredHighlightOrdinal: undefined, centeredOrdinal: undefined, hasCenter: false}
export const centerStore = makeStore<CenterState>(noCenter)
export const setCenter = (ordinal: T.Chat.Ordinal | undefined) =>
  centerStore.reset({centeredHighlightOrdinal: ordinal, centeredOrdinal: ordinal, hasCenter: !!ordinal})

type InputState = {editing: T.Chat.Ordinal | undefined}
export const inputStore = makeStore<InputState>({editing: undefined})
export const inputStateModule = {
  useConversationInput: <R,>(selector: (s: InputState) => R) => useStore(inputStore, selector),
}

type ScrollRef = {scrollDown: () => void; scrollToBottom: () => void; scrollUp: () => void}
// The list registers its imperative scrolls through ThreadRefsContext; this captures them.
export const threadRefs: {current: ScrollRef | null} = {current: null}
export const threadRefsValue: React.ContextType<typeof ThreadRefsContext> = {
  focusInput: () => {},
  scrollDown: () => threadRefs.current?.scrollDown(),
  scrollToBottom: () => threadRefs.current?.scrollToBottom(),
  scrollUp: () => threadRefs.current?.scrollUp(),
  setInputRef: () => {},
  setScrollRef: r => {
    threadRefs.current = r
  },
}

// What both harnesses reset before each test.
export const resetShared = () => {
  log.length = 0
  threadRefs.current = null
  centerStore.reset(noCenter)
  inputStore.reset({editing: undefined})
}

// The part of the thread store the lists read, moved the way the thread's own actions move it.
// thread-transitions.test.tsx checks each transition against the real thread store, so tests built
// on these only reach states the thread can actually be in.
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
