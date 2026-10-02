import {ensureError, RPCError} from '@/util/errors'
import {printOutstandingRPCs} from '@/local-debug'
import {getAccountGeneration, survivesAccountChange} from './account-generation'
import {inputCanceledError, type CommonResponseHandler, type ResponseType, type WaitingKey} from './types'
import {wrapErrors} from '@/util/debug'
import type {ErrorType} from './rpc-transport'
import type {CallPort, ListenParams} from './call-port'

type ListenEngine = {
  call: CallPort['call']
  dispatchWaitingAction: (key: WaitingKey, waiting: boolean, error?: RPCError) => void
  cancelSession: (sessionID: number) => void
}

export const makeListen = (engine: ListenEngine) => async (p: ListenParams) => {
  return new Promise((resolve, reject) => {
    const {method, params, waitingKey} = p
    const incomingCallMap = (p.incomingCallMap || {}) as {[K in string]: (params: unknown) => Promise<void>}
    const customResponseIncomingCallMap = (p.customResponseIncomingCallMap || {}) as {
      [K in string]: (params: unknown, response: Partial<CommonResponseHandler>) => Promise<void>
    }

    // Whether we've told the waiting store the server is working (vs. parked on a GUI prompt).
    // Dispatches are deduped through this flag so a client-side cancel arriving while a prompt is
    // up can't dispatch a second waiting=false and decrement the count below zero.
    let waitingOnServer = false
    const setWaitingOnServer = (waiting: boolean, error?: RPCError) => {
      if (!waitingKey || waitingOnServer === waiting) {
        return
      }
      waitingOnServer = waiting
      engine.dispatchWaitingAction(waitingKey, waiting, error)
    }

    // Wraps a response to update the waiting state
    // A late answer to a settled response reaches no server, so it must not count as waiting on one.
    const makeWaitingResponse = (r: ResponseType) => {
      if (!waitingKey) {
        return r as Partial<CommonResponseHandler>
      }

      const response: Partial<CommonResponseHandler> & {readonly settled?: boolean} = {
        get settled() {
          return r.settled
        },
      }

      if (r.error) {
        response.error = (e: ErrorType) => {
          if (!r.settled) {
            setWaitingOnServer(true)
          }
          r.error?.(e)
        }
      }

      if (r.result) {
        response.result = (...args: Array<unknown>) => {
          if (!r.settled) {
            setWaitingOnServer(true)
          }
          r.result?.(...args)
        }
      }

      return response
    }

    // Waiting on the server
    setWaitingOnServer(true)

    // Handlers run on a timer so transport work can flush before heavier state updates. By then an
    // account switch may have reset the stores the handler writes to, unless this call outlives it.
    const runDeferred = (
      run: () => Promise<void>,
      onStale: () => void,
      onFailed: () => void,
      handlerMethod: string
    ) => {
      const generation = getAccountGeneration()
      setTimeout(() => {
        if (getAccountGeneration() !== generation && !survivesAccountChange(method)) {
          onStale()
          return
        }
        // wrapErrors logs the failure
        wrapErrors(run, handlerMethod)().catch(onFailed)
      }, 0)
    }

    if (__DEV__) {
      for (const m of Object.keys(incomingCallMap)) {
        if (customResponseIncomingCallMap[m]) {
          throw new Error(`Invalid method in both incomingCallMap and customResponseIncomingCallMap: ${m}`)
        }
      }
    }

    // The session acks these itself
    const plainMap: {[key: string]: (params: unknown) => void} = {}
    for (const m of Object.keys(incomingCallMap)) {
      plainMap[m] = (params: unknown) => {
        runDeferred(async () => incomingCallMap[m]?.(params), () => {}, () => {}, m)
      }
    }

    const customMap: {[key: string]: (params: unknown, response: ResponseType) => void} = {}
    for (const m of Object.keys(customResponseIncomingCallMap)) {
      customMap[m] = (params: unknown, sessionResponse: ResponseType) => {
        // No longer waiting on the server
        setWaitingOnServer(false)
        const response = makeWaitingResponse(sessionResponse)
        // The service is still waiting on this prompt, and no handler will answer it
        const refuse = () => {
          if (!sessionResponse.settled) {
            response.error?.(inputCanceledError)
          }
        }
        runDeferred(
          async () => {
            // Settled meanwhile: the session ended or was cancelled, so nothing reads this answer
            if (!sessionResponse.settled) {
              await customResponseIncomingCallMap[m]?.(params, response)
            }
          },
          refuse,
          refuse,
          m
        )
      }
    }

    // Make the actual call
    let outstandingIntervalID: ReturnType<typeof setInterval>
    if (printOutstandingRPCs) {
      outstandingIntervalID = setInterval(() => {
        console.log('Engine/Listener with a still-alive eventChannel for method:', method)
      }, 2000)
    }

    const sessionID = engine.call({
      callback: (error?: RPCError, params?: unknown) => {
        if (printOutstandingRPCs) {
          clearInterval(outstandingIntervalID)
        }

        // No longer waiting
        setWaitingOnServer(false, error instanceof RPCError ? error : undefined)

        if (error) {
          reject(ensureError(error))
        } else {
          resolve(params)
        }
      },
      customResponseIncomingCallMap: customMap,
      // Always a list, so an unhandled incoming method on a listener is checked against it
      globalFallthrough: p.globalFallthrough ?? [],
      incomingCallMap: plainMap,
      method,
      params,
    })
    p.onSessionCreated?.(() => engine.cancelSession(sessionID))
  })
}
