import {ensureError, type RPCError} from '@/util/errors'
import {printOutstandingRPCs} from '@/local-debug'
import {getAccountGeneration, survivesAccountChange} from './account-generation'
import {inputCanceledError, type CommonResponseHandler, type ResponseType} from './types'
import {wrapErrors} from '@/util/debug'
import type {CallPort, ListenParams} from './call-port'
import type {DeferRun} from './session'

type ListenEngine = {
  call: CallPort['call']
  cancelSession: (sessionID: number) => void
  holdServerWork: (sessionID: number) => () => void
}

export const makeListen = (engine: ListenEngine) => async (p: ListenParams) => {
  return new Promise((resolve, reject) => {
    const {method, params, waitingKey} = p
    const incomingCallMap = (p.incomingCallMap || {}) as {[K in string]: (params: unknown) => Promise<void>}
    const customResponseIncomingCallMap = (p.customResponseIncomingCallMap || {}) as {
      [K in string]: (params: unknown, response: Partial<CommonResponseHandler>) => Promise<void>
    }

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

    const customMap: {[key: string]: (params: unknown, response: ResponseType, deferRun: DeferRun) => void} = {}
    for (const m of Object.keys(customResponseIncomingCallMap)) {
      customMap[m] = (params: unknown, response: ResponseType, deferRun: DeferRun) => {
        // The session learns whether the handler answered once it has run
        const ran = deferRun()
        // The service is still waiting on this prompt, and no handler will answer it
        const refuse = () => {
          if (!response.settled) {
            response.error?.(inputCanceledError)
          }
        }
        runDeferred(
          async () => {
            // Settled meanwhile: the session ended or was cancelled, so nothing reads this answer
            if (response.settled) {
              return
            }
            const answered = customResponseIncomingCallMap[m]?.(params, response as Partial<CommonResponseHandler>)
            ran()
            await answered
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
      waitingKey,
    })
    p.onSessionCreated?.(() => engine.cancelSession(sessionID), {
      holdServerWork: () => engine.holdServerWork(sessionID),
    })
  })
}
