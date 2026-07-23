import {getEngine} from './require'
import {ensureError, RPCError} from '@/util/errors'
import {printOutstandingRPCs} from '@/local-debug'
import type {CommonResponseHandler, WaitingKey} from './types'
import {wrapErrors} from '@/util/debug'
import type {ErrorType} from './rpc-transport'

async function listener(p: {
  method: string
  params?: object
  incomingCallMap?: {[K in string]: (params: unknown) => Promise<void>}
  customResponseIncomingCallMap?: {
    [K in string]: (params: unknown, response: Partial<CommonResponseHandler>) => Promise<void>
  }
  waitingKey?: WaitingKey
  onSessionCreated?: (cancel: () => void) => void
}) {
  return new Promise((resolve, reject) => {
    const {method, params, waitingKey} = p
    const incomingCallMap = p.incomingCallMap || {}
    const customResponseIncomingCallMap = p.customResponseIncomingCallMap || {}

    // Whether we've told the waiting store the server is working (vs. parked on a GUI prompt).
    // Dispatches are deduped through this flag so a client-side cancel arriving while a prompt is
    // up can't dispatch a second waiting=false and decrement the count below zero.
    let waitingOnServer = false
    const setWaitingOnServer = (waiting: boolean, error?: RPCError) => {
      if (!waitingKey || waitingOnServer === waiting) {
        return
      }
      waitingOnServer = waiting
      getEngine().dispatchWaitingAction(waitingKey, waiting, error)
    }

    // Wraps a response to update the waiting state
    const makeWaitingResponse = (r?: Partial<CommonResponseHandler>) => {
      if (!r || !waitingKey) {
        return r
      }

      const response: Partial<CommonResponseHandler> = {}

      if (r.error) {
        response.error = (e: ErrorType) => {
          // Waiting on the server again
          setWaitingOnServer(true)
          r.error?.(e)
        }
      }

      if (r.result) {
        response.result = (...args: Array<unknown>) => {
          // Waiting on the server again
          setWaitingOnServer(true)
          r.result?.(...args)
        }
      }

      return response
    }

    // Waiting on the server
    setWaitingOnServer(true)

    const makeHandler = (method: string, custom: boolean) => {
      return (params: unknown, _response: CommonResponseHandler) => {
        // No longer waiting on the server
        setWaitingOnServer(false)

        let response = makeWaitingResponse(_response)

        if (__DEV__) {
          if (incomingCallMap[method] && customResponseIncomingCallMap[method]) {
            throw new Error('Invalid method in both incomingCallMap and customResponseIncomingCallMap ')
          }
        }

        if (!custom) {
          if (response) {
            response.result?.()
            response = undefined
          }
        }

        // Yield after sending the auto-response so transport work can flush
        // before handlers do heavier state updates.
        setTimeout(() => {
          const invokeAndDispatch = wrapErrors(async () => {
            if (response) {
              const cb = customResponseIncomingCallMap[method]
              await cb?.(params, response)
            } else {
              const cb = incomingCallMap[method]
              await cb?.(params)
            }
          }, method)

          invokeAndDispatch().catch(() => {})
        }, 0)
      }
    }

    const callMap: {[key: string]: unknown} = {}
    for (const method of Object.keys(incomingCallMap)) {
      callMap[method] = makeHandler(method, false)
    }
    for (const method of Object.keys(customResponseIncomingCallMap)) {
      callMap[method] = makeHandler(method, true)
    }

    // Make the actual call
    let outstandingIntervalID: ReturnType<typeof setInterval>
    if (printOutstandingRPCs) {
      outstandingIntervalID = setInterval(() => {
        console.log('Engine/Listener with a still-alive eventChannel for method:', method)
      }, 2000)
    }

    const sessionID = getEngine()._rpcOutgoing({
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
      incomingCallMap: callMap,
      method,
      params,
    })
    p.onSessionCreated?.(() => getEngine().cancelSession(sessionID))
  })
}

export default listener
