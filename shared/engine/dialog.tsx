// A typed conversation with the service over one listener RPC. The service's prompts surface as
// Prompt objects to answer or cancel, so the raw responses never leave this file.
import {
  StatusCode,
  type CustomResponseIncomingCallMap,
  type IncomingCallMapType,
  type MessageKey,
  type RpcIn,
  type RpcOut,
} from '@/constants/rpc/rpc-gen'
import {RPCError} from '@/util/errors'
import {getCallPort} from './call-port'
import {survivesAccountChange} from './account-generation'
import {inputCanceledError, type CommonResponseHandler, type WaitingKey} from './types'

export type PromptMethod = keyof CustomResponseIncomingCallMap & MessageKey
export type NoticeMethod = keyof IncomingCallMapType & MessageKey
// 'ended': the session settled it (the RPC replied or failed, or the service cancelled the prompt)
export type PromptOutcome = 'answered' | 'cancelled' | 'ended'

export type Prompt<M extends PromptMethod = PromptMethod> = {
  readonly id: number
  readonly method: M
  readonly params: RpcIn<M>
  readonly open: boolean
  // false, writing nothing, once the prompt is closed
  answer: (v: RpcOut<M>) => boolean
  // Refuses with scinputcanceled; false, writing nothing, once the prompt is closed
  cancel: () => boolean
  readonly closed: Promise<PromptOutcome>
}

type PromptEventOf<M extends PromptMethod> = {readonly kind: 'prompt'} & Prompt<M>
type NoticeEventOf<N extends NoticeMethod> = {readonly kind: 'notice'; method: N; params: RpcIn<N>}
// Distributes over the methods, so checking `method` narrows `params`
export type DialogEvent<P extends PromptMethod, N extends NoticeMethod> =
  | {[M in P]: PromptEventOf<M>}[P]
  | {[M in N]: NoticeEventOf<M>}[N]

export type Dialog<R, P extends PromptMethod, N extends NoticeMethod> = {
  // Arrival order. Single consumer: a second iteration throws, and leaving the loop early disposes.
  // Ends after done settles, once the calls the service made before then are delivered; at once on dispose.
  readonly events: AsyncIterable<DialogEvent<P, N>>
  // The RPC's result. Rejects with its error, or with sccanceled on dispose.
  readonly done: Promise<R>
  readonly disposed: boolean
  prompt: <M extends P>(id: number, method: M) => Prompt<M> | undefined
  openPrompts: () => ReadonlyArray<Prompt<P>>
  // Refuses open prompts and, until the RPC ends, everything else the service sends on the session
  dispose: () => void
}

type AutoAnswer = {[K in PromptMethod]?: (params: RpcIn<K>) => RpcOut<K> | 'refuse'}

type Response = Partial<CommonResponseHandler> & {readonly settled?: boolean}

let nextPromptID = 1

// Dialogs whose RPC has not ended and that are not disposed
const live = new Set<{method: MessageKey; dispose: () => void}>()

// A logout ends every dialog of the old account. A dialog whose RPC changes the account on purpose
// (login, recover, reset) keeps running: its own flow logs out before or during it.
export const disposeDialogsForLogout = () => {
  for (const d of [...live]) {
    if (!survivesAccountChange(d.method)) {
      d.dispose()
    }
  }
}

export const openDialog = <M extends MessageKey, P extends PromptMethod, N extends NoticeMethod = never>(
  method: M,
  params: RpcIn<M>,
  opts: {
    prompts: ReadonlyArray<P>
    notices?: ReadonlyArray<N>
    // Answered as they arrive and never surfaced
    autoAnswer?: AutoAnswer
    waitingKey?: WaitingKey
    globalFallthrough?: ReadonlyArray<string>
  }
): Dialog<RpcOut<M>, P, N> => {
  type Event = DialogEvent<P, N>
  type AnyPrompt = PromptEventOf<P>

  let disposed = false
  // The iterator has nothing more to give once the queue drains
  let finished = false
  let iterated = false
  const queue: Array<Event> = []
  let waiters: Array<() => void> = []
  const wake = () => {
    const w = waiters
    waiters = []
    w.forEach(r => r())
  }
  const open = new Map<number, {prompt: AnyPrompt; close: (o: PromptOutcome) => void}>()

  const finish = () => {
    finished = true
    wake()
  }

  const enqueue = (e: Event) => {
    if (finished) {
      return
    }
    queue.push(e)
    wake()
  }

  const makePrompt = (m: P, p: RpcIn<P>, response: Response) => {
    const id = nextPromptID++
    let outcome: PromptOutcome | undefined
    let resolveClosed: (o: PromptOutcome) => void = () => {}
    const closed = new Promise<PromptOutcome>(resolve => {
      resolveClosed = resolve
    })
    const close = (o: PromptOutcome) => {
      if (outcome) {
        return
      }
      outcome = o
      open.delete(id)
      resolveClosed(o)
    }
    // The session may settle it first (service cancel, link loss); that is seen here at once
    const isOpen = () => !outcome && !response.settled
    const prompt = {
      answer: (v: unknown) => {
        if (!isOpen()) {
          return false
        }
        close('answered')
        response.result?.(v)
        return true
      },
      cancel: () => {
        if (!isOpen()) {
          return false
        }
        close('cancelled')
        response.error?.(inputCanceledError)
        return true
      },
      closed,
      id,
      kind: 'prompt',
      method: m,
      get open() {
        return isOpen()
      },
      params: p,
    } as AnyPrompt
    open.set(id, {close, prompt})
    return prompt
  }

  const surface = (m: P) => (p: RpcIn<P>, response: Response) => {
    // Nothing would read it
    if (finished) {
      response.error?.(inputCanceledError)
      return
    }
    enqueue(makePrompt(m, p, response) as Event)
  }
  const customResponseIncomingCallMap: {[K in string]: (params: never, response: Response) => void} = {}
  for (const m of opts.prompts) {
    customResponseIncomingCallMap[m] = surface(m)
  }
  for (const [m, auto] of Object.entries(opts.autoAnswer ?? {}) as Array<[string, (p: unknown) => unknown]>) {
    if (__DEV__ && customResponseIncomingCallMap[m]) {
      throw new Error(`openDialog: ${m} is both a prompt and auto-answered`)
    }
    customResponseIncomingCallMap[m] = (p: unknown, response: Response) => {
      const v = auto(p)
      if (v === 'refuse') {
        response.error?.(inputCanceledError)
      } else {
        response.result?.(v)
      }
    }
  }
  const incomingCallMap: {[K in string]: (params: never) => void} = {}
  for (const m of opts.notices ?? []) {
    incomingCallMap[m] = (p: RpcIn<N>) => enqueue({kind: 'notice', method: m, params: p} as Event)
  }

  let cancelSession = () => {}
  let rejectDone: (e: RPCError) => void = () => {}
  const done = new Promise<RpcOut<M>>((resolve, reject) => {
    rejectDone = reject
    getCallPort()
      .listen({
        customResponseIncomingCallMap,
        globalFallthrough: opts.globalFallthrough,
        incomingCallMap,
        method,
        onSessionCreated: cancel => {
          cancelSession = cancel
        },
        params,
        waitingKey: opts.waitingKey,
      })
      .then(r => resolve(r as RpcOut<M>))
      .catch(reject)
  })

  const end = () => {
    live.delete(entry)
    // The session settled whatever was still held when its RPC ended
    for (const {close} of [...open.values()]) {
      close('ended')
    }
    // The listener hands calls to their handlers on a timer, so calls the service made before the
    // RPC ended may still be on theirs; this one runs after them
    setTimeout(finish, 0)
  }
  // Also marks done handled: a caller that disposed has stopped listening and may never await it
  done.finally(end).catch(() => {})

  const dispose = () => {
    if (disposed) {
      return
    }
    disposed = true
    for (const {prompt} of [...open.values()]) {
      prompt.cancel()
    }
    queue.length = 0
    finish()
    live.delete(entry)
    cancelSession()
    rejectDone(new RPCError('Dialog disposed', StatusCode.sccanceled))
  }
  const entry = {dispose, method}
  live.add(entry)

  const moreEvents = async () =>
    new Promise<void>(resolve => {
      waiters.push(resolve)
    })
  const iterator: AsyncIterator<Event> = {
    next: async () => {
      for (;;) {
        const e = queue.shift()
        if (e) {
          // Closed while queued: nothing left to answer
          if (e.kind === 'prompt' && !e.open) {
            continue
          }
          return {done: false, value: e}
        }
        if (finished) {
          return {done: true, value: undefined}
        }
        // eslint-disable-next-line no-await-in-loop
        await moreEvents()
      }
    },
    return: async () => {
      dispose()
      // Disposed, so this reads the end
      return await iterator.next()
    },
  }

  return {
    get disposed() {
      return disposed
    },
    dispose,
    done,
    events: {
      [Symbol.asyncIterator]: () => {
        if (iterated) {
          throw new Error('Dialog events can only be iterated once')
        }
        iterated = true
        return iterator
      },
    },
    openPrompts: () => [...open.values()].map(o => o.prompt).filter(p => p.open),
    prompt: <K extends P>(id: number, m: K) => {
      const p = open.get(id)?.prompt
      return p?.method === m && p.open ? (p as unknown as Prompt<K>) : undefined
    },
  }
}
