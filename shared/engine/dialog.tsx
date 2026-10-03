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
// Distributes over the methods, so checking `method` narrows `params` and `answer`
export type AnyPrompt<P extends PromptMethod> = {[M in P]: Prompt<M>}[P]
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
  // The earliest open prompt of that method
  openPrompt: <M extends P>(method: M) => Prompt<M> | undefined
  openPrompts: () => ReadonlyArray<AnyPrompt<P>>
  // Refuses open prompts and, until the RPC ends, everything else the service sends on the session
  dispose: () => void
  // Keeps the waiting key on while prompts are open, for a flow that knows the service works on
  // meanwhile. Ends when the returned function runs or the RPC ends.
  holdWaiting: () => () => void
}

// A method is either surfaced or auto-answered, never both
type AutoAnswer<P extends PromptMethod> = {
  [K in Exclude<PromptMethod, P>]?: (params: RpcIn<K>) => RpcOut<K>
}

type Response = Partial<CommonResponseHandler> & {
  readonly settled?: boolean
  onCancelledByService?: () => void
}

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
    autoAnswer?: NoInfer<AutoAnswer<P>>
    waitingKey?: WaitingKey
    globalFallthrough?: ReadonlyArray<string>
  }
): Dialog<RpcOut<M>, P, N> => {
  type Event = DialogEvent<P, N>
  type OpenPrompt = PromptEventOf<P>

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
  const open = new Map<number, {prompt: OpenPrompt; close: (o: PromptOutcome) => void}>()

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
    } as OpenPrompt
    response.onCancelledByService = () => close('ended')
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
      // The callback may have disposed the dialog, which refused this already
      if (response.settled) {
        return
      }
      response.result?.(v)
    }
  }
  const incomingCallMap: {[K in string]: (params: never) => void} = {}
  for (const m of opts.notices ?? []) {
    incomingCallMap[m] = (p: RpcIn<N>) => enqueue({kind: 'notice', method: m, params: p} as Event)
  }

  let cancelSession = () => {}
  let holdServerWork = () => () => {}
  let resolveDone: (r: RpcOut<M>) => void = () => {}
  let rejectDone: (e: unknown) => void = () => {}
  const done = new Promise<RpcOut<M>>((resolve, reject) => {
    resolveDone = resolve
    rejectDone = reject
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

  getCallPort()
    .listen({
      customResponseIncomingCallMap,
      globalFallthrough: opts.globalFallthrough,
      incomingCallMap,
      method,
      onSessionCreated: (cancel, session) => {
        cancelSession = cancel
        holdServerWork = session.holdServerWork
      },
      params,
      waitingKey: opts.waitingKey,
    })
    .then(r => {
      end()
      resolveDone(r as RpcOut<M>)
    })
    .catch((e: unknown) => {
      end()
      // The listener rejects with ensureError(e), which wraps an RPCError (not an Error) as the cause of a
      // plain Error; flows match on the RPCError's code, so done rejects with it
      rejectDone(e instanceof Error && e.cause instanceof RPCError ? e.cause : e)
    })

  const dispose = () => {
    if (disposed) {
      return
    }
    disposed = true
    for (const {close, prompt} of [...open.values()]) {
      if (prompt.open) {
        close('cancelled')
      }
    }
    queue.length = 0
    finish()
    live.delete(entry)
    // Refuses the prompts closed above once it has stopped the RPC waiting, so refusing them does not
    // show the RPC waiting on the service again on its way out
    cancelSession()
    rejectDone(new RPCError('Dialog disposed', StatusCode.sccanceled))
    // Whoever disposed has stopped listening and may never await done; any other rejection is
    // left unhandled so a flow that forgot to await it is reported
    done.catch(() => {})
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
    holdWaiting: () => holdServerWork(),
    openPrompt: <K extends P>(m: K) => {
      const p = [...open.values()].find(o => o.prompt.method === m && o.prompt.open)?.prompt
      return p as unknown as Prompt<K> | undefined
    },
    openPrompts: () => [...open.values()].map(o => o.prompt).filter(p => p.open) as Array<AnyPrompt<P>>,
    prompt: <K extends P>(id: number, m: K) => {
      const p = open.get(id)?.prompt
      return p?.method === m && p.open ? (p as unknown as Prompt<K>) : undefined
    },
  }
}
