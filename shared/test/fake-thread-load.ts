// Scripts the chat service's side of a thread load on the fake engine: getThreadNonblock and the
// chatThreadCached / chatThreadFull / chatThreadStatus calls it makes into the GUI's session while
// it runs. The app's own adapter, Engine, Session and listener all run in between, so a stream
// lands when the real listener runs it, not when the script calls it.
//
// Each stream call resolves once the GUI has acked it. The session acks a plain incoming call at
// once and the listener runs its handler on a later timer, so awaiting a stream says only that the
// service may go on; it does not say the handler has run.
import {setImmediate} from 'node:timers'
import * as T from '@/constants/types'
import type {FakeAnswer, FakeEngine} from './fake-engine'

export const getThreadNonblock = 'chat.1.local.getThreadNonblock'

export type ThreadLoad = {
  // getThreadNonblock's params as the service decoded them
  params: any
  conversationIDKey: T.Chat.ConversationIDKey
  cached: (thread: string) => Promise<void>
  full: (thread: string) => Promise<void>
  status: (status: T.RPCChat.UIChatThreadStatus) => Promise<void>
}

// The service's reply to a load that went well
export const threadLoaded: T.RPCChat.NonblockFetchRes = {offline: false}

const streamTo = (fake: FakeEngine, sessionID: number) => async (method: string, params: object) => {
  const {error} = await fake.push(method, params, {sessionID})
  if (error) {
    throw new Error(`fake thread load: the GUI refused ${method}: ${JSON.stringify(error)}`)
  }
}

export const threadLoadOf = (fake: FakeEngine, params: any): ThreadLoad => {
  const stream = streamTo(fake, params.sessionID as number)
  return {
    cached: async thread => stream('chat.1.chatUi.chatThreadCached', {thread}),
    conversationIDKey: T.Chat.conversationIDToKey(params.conversationID as Uint8Array),
    full: async thread => stream('chat.1.chatUi.chatThreadFull', {thread}),
    params,
    status: async status => stream('chat.1.chatUi.chatThreadStatus', {status}),
  }
}

// Answers every getThreadNonblock with what the script returns (threadLoaded when it returns
// nothing), after the script has streamed whatever it awaited.
export const answerThreadLoads = (
  fake: FakeEngine,
  script: (load: ThreadLoad) => FakeAnswer = () => undefined
) => {
  fake.answer(getThreadNonblock, async params => (await script(threadLoadOf(fake, params))) ?? threadLoaded)
}

// The params of every call of `method` the service received, in order, without the sessionID the
// engine stamps on each
export const paramsOf = (fake: FakeEngine, method: string): Array<any> =>
  fake.calls
    .filter(c => c.method === method)
    .map(c => {
      const {sessionID: _, ...params} = c.params as {sessionID: number}
      return params
    })

type HeldTimer = {run: () => void; cancelled: boolean}

// Picks the other legal order of a reply and the streams before it: the session acks a pushed call
// at once and the listener hands it to its handler on a 0ms timer, so a reply that crosses the IPC
// hop before that timer is due (a busy renderer, a loaded machine) reaches the session first. Real
// timers decide that race nondeterministically; this holds every 0ms timer set from now on, so a
// test can choose it.
//
// A script calls this before it streams, then returns `replyFirst(answer)`: the held timers run, in
// the order they were set, once that reply has reached the caller and its continuations have run.
export const holdHandlerTimers = () => {
  const held: Array<HeldTimer> = []
  const realSetTimeout = globalThis.setTimeout
  const realClearTimeout = globalThis.clearTimeout
  const setSpy = jest.spyOn(globalThis, 'setTimeout').mockImplementation(((
    fn: (...a: Array<unknown>) => void,
    ms?: number,
    ...args: Array<unknown>
  ) => {
    if (ms) {
      return realSetTimeout(fn, ms, ...args)
    }
    const timer: HeldTimer = {cancelled: false, run: () => fn(...args)}
    held.push(timer)
    return timer
  }) as unknown as typeof setTimeout)
  const clearSpy = jest.spyOn(globalThis, 'clearTimeout').mockImplementation((id => {
    const timer = held.find(t => t === (id as unknown))
    if (timer) {
      timer.cancelled = true
    } else {
      (realClearTimeout as (id: unknown) => void)(id)
    }
  }) as typeof clearTimeout)
  const release = () => {
    setSpy.mockRestore()
    for (const timer of held) {
      realSetTimeout(() => !timer.cancelled && timer.run(), 0)
    }
    // a held handle can still be cleared until it has run; these real timers fire in order, so the
    // spy comes off after the last held one
    realSetTimeout(() => {
      held.length = 0
      clearSpy.mockRestore()
    }, 0)
  }
  return {
    release,
    // The service sends its reply when the script returns, and the relay delivers it a check phase
    // later; the release goes one loop turn after that, once the caller's continuations have run.
    replyFirst: <A>(answer: A): A => {
      setImmediate(() => setImmediate(release))
      return answer
    },
  }
}
