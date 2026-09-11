// A second adapter behind the engine seam, for tests.
//
// Every generated *RpcPromise and every engine listener funnels through
// getEngine()._rpcOutgoing, so answering there lets a test say what the SERVICE
// returns for a wire method instead of spying on whichever generated symbol the
// implementation currently happens to call.
import {RPCError} from '@/util/errors'
import {StatusCode} from '@/constants/rpc/rpc-gen'
import {
  getEngineListener,
  hasEngine,
  initEngine,
  initEngineListener,
  getEngine,
  resetEngine,
  type EngineSeam,
} from '@/engine/require'
import engineListener from '@/engine/listener'
import {useWaitingState} from '@/stores/waiting'
import type * as RPCChatGen from '@/constants/rpc/rpc-chat-gen'
import type * as RPCGen from '@/constants/rpc/rpc-gen'
import type * as RPCGregorGen from '@/constants/rpc/rpc-gregor-gen'
import type * as RPCStellarGen from '@/constants/rpc/rpc-stellar-gen'
import type {WaitingKey} from '@/engine/types'

type AllMessageTypes = RPCGen.MessageTypes &
  RPCChatGen.MessageTypes &
  RPCGregorGen.MessageTypes &
  RPCStellarGen.MessageTypes

export type WireMethod = keyof AllMessageTypes

export type FakeRpcResponse = {
  error?: (err: unknown) => void
  result?: (...args: Array<unknown>) => void
}

export type FakeRpcContext = {
  method: string
  sessionID: number
  /**
   * Fire one of the call's incoming (streaming/incremental) callbacks, the way
   * the service does mid-flight. Only meaningful for methods the caller reached
   * through an incomingCallMap.
   *
   * The real listener defers each incoming handler by a macrotask, so a stub
   * that emits and then returns settles the outer promise first. Await a
   * macrotask before returning if the test needs them in service order.
   */
  incoming: (method: string, params: unknown, response?: FakeRpcResponse) => void
  /** True once cancelSession ran; a streaming handler should stop emitting. */
  isCancelled: () => boolean
}

export type FakeEngineHandlers = {
  [M in WireMethod]?: (
    params: AllMessageTypes[M]['inParam'],
    ctx: FakeRpcContext
  ) => AllMessageTypes[M]['outParam'] | Promise<AllMessageTypes[M]['outParam']>
}

type UntypedHandler = (params: unknown, ctx: FakeRpcContext) => unknown
type IncomingHandler = (params: unknown, response: FakeRpcResponse) => void

export type FakeEngine = {
  /** How many times this wire method was called since install (or the last reset). */
  callCount: (method: WireMethod) => number
  /** Every recorded call, oldest first; pass a method to filter. */
  calls: (method?: WireMethod) => ReadonlyArray<{method: string; params: unknown}>
  /** Methods a test asked for but never stubbed. Each also failed loudly when it happened. */
  unhandledMethods: () => ReadonlyArray<string>
  /** Add to or replace handlers mid-test, e.g. to make a reload return new data. */
  setHandlers: (handlers: FakeEngineHandlers) => void
  resetCalls: () => void
  uninstall: () => void
}

const noopResponse: FakeRpcResponse = {error: () => {}, result: () => {}}

export const installFakeEngine = (initialHandlers: FakeEngineHandlers = {}): FakeEngine => {
  const previousEngine = hasEngine() ? getEngine() : undefined
  const previousListener: unknown = getEngineListener()
  let handlers = {...initialHandlers} as {[key: string]: UntypedHandler | undefined}
  const recorded: Array<{method: string; params: unknown}> = []
  const unhandled: Array<string> = []
  type FakeSession = {
    cancelled: boolean
    done: boolean
    finish: (error?: RPCError, skipWaitingRelease?: boolean) => void
    // seqids the caller still owes the service a response for, mirroring
    // Session._seqIDsAwaitingResponse
    owed: number
  }
  const sessions = new Map<number, FakeSession>()
  let nextSessionID = 1

  // The real engine throttles waiting changes over 500ms. Applying them straight
  // through keeps a test's assertion about a waiting key readable without having
  // to drive timers.
  const dispatchWaitingAction = (key: WaitingKey, waiting: boolean, error?: RPCError) => {
    useWaitingState.getState().dispatch.batch([{error, increment: waiting, key}])
  }

  const seam: EngineSeam = {
    _rpcOutgoing: p => {
      const {method, params, callback, incomingCallMap, customResponseIncomingCallMap, waitingKey} = p
      const sessionID = nextSessionID++
      recorded.push({method, params})
      const session: FakeSession = {cancelled: false, done: false, finish: () => {}, owed: 0}
      sessions.set(sessionID, session)

      const setWaiting = (waiting: boolean, error?: RPCError) => {
        if (waitingKey) {
          dispatchWaitingAction(waitingKey, waiting, error)
        }
      }

      const finish = (error: RPCError | undefined, result?: unknown, skipWaitingRelease = false) => {
        if (session.done) {
          return
        }
        session.done = true
        sessions.delete(sessionID)
        if (!skipWaitingRelease) {
          setWaiting(false, error)
        }
        callback(error, result)
      }
      session.finish = (error, skipWaitingRelease) => {
        finish(error, undefined, skipWaitingRelease)
      }

      const plainMap = incomingCallMap as {[key: string]: IncomingHandler | undefined} | undefined
      const customMap = customResponseIncomingCallMap as
        | {[key: string]: IncomingHandler | undefined}
        | undefined

      const ctx: FakeRpcContext = {
        incoming: (incomingMethod, incomingParams, response) => {
          if (session.done) {
            return
          }
          const handler = plainMap?.[incomingMethod] ?? customMap?.[incomingMethod]
          if (!handler) {
            console.error(
              `fake engine: "${method}" emitted incoming call "${incomingMethod}" but the caller registered no handler for it`
            )
            return
          }
          // Mirrors Session.incomingCall: the service talking to us means we are
          // no longer waiting on it, and we are again once we have replied.
          setWaiting(false)
          session.owed++
          const responded = () => {
            session.owed--
            setWaiting(true)
          }
          const wrapped: FakeRpcResponse = {
            error: (...args: Array<unknown>) => {
              ;(response ?? noopResponse).error?.(args[0])
              responded()
            },
            result: (...args: Array<unknown>) => {
              ;(response ?? noopResponse).result?.(...args)
              responded()
            },
          }
          handler(incomingParams, wrapped)
        },
        isCancelled: () => session.cancelled,
        method,
        sessionID,
      }

      setWaiting(true)

      const handler = handlers[method]
      if (!handler) {
        const message = `fake engine: no handler installed for RPC "${method}" - add it to installFakeEngine({...})`
        unhandled.push(method)
        // console.error fails the test through test/fail-on-console even when the
        // caller swallows the rejection, so an unstubbed RPC can never look like a
        // load that simply never finished.
        console.error(message)
        Promise.resolve()
          .then(() => finish(new RPCError(message, StatusCode.scgeneric)))
          .catch(() => {})
        return sessionID
      }

      Promise.resolve()
        // Session.start puts the sessionID in the outgoing param, so the stub -
        // which stands in for the service - sees it too. `calls()` keeps the raw
        // params the caller passed, which is what assertions want.
        .then(() => handler({...(params ?? {}), sessionID}, ctx))
        .then(
          result => {
            if (!session.cancelled) {
              finish(undefined, result)
            }
          },
          (error: unknown) => {
            if (!session.cancelled) {
              finish(error as RPCError)
            }
          }
        )
        .catch(() => {})

      return sessionID
    },
    cancelSession: sessionID => {
      const session = sessions.get(sessionID)
      if (!session || session.done) {
        return
      }
      session.cancelled = true
      // Same rejection the real Session.cancel hands back, so a caller that
      // branches on sccanceled - or just awaits - is not left hanging. The
      // waiting release is skipped while the caller still owes the service a
      // response: that path already released it, and the waiting store does not
      // clamp, so releasing twice drives the count negative.
      session.finish(
        new RPCError('Received RPC cancel for session', StatusCode.sccanceled),
        session.owed !== 0
      )
    },
    createSession: () => {
      throw new Error('fake engine: createSession is not supported')
    },
    dispatchWaitingAction,
  }

  initEngine(seam)
  // The real listener, so *RpcListener calls take the production path down to
  // _rpcOutgoing instead of needing their own stand-in.
  initEngineListener(engineListener)

  return {
    callCount: method => recorded.reduce((n, c) => (c.method === method ? n + 1 : n), 0),
    calls: method => (method ? recorded.filter(c => c.method === method) : [...recorded]),
    resetCalls: () => {
      recorded.length = 0
      unhandled.length = 0
    },
    setHandlers: next => {
      handlers = {...handlers, ...(next as {[key: string]: UntypedHandler | undefined})}
    },
    uninstall: () => {
      // restore, not just clear: a file may install twice, or may have had a
      // real engine before, and leaving the seam empty makes the next
      // getEngine() throw instead of reaching whatever was there
      if (previousEngine) {
        initEngine(previousEngine)
      } else {
        resetEngine()
      }
      initEngineListener(previousListener)
    },
    unhandledMethods: () => [...unhandled],
  }
}
