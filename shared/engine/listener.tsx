import {getEngine} from './require'
import {ensureError, RPCError} from '@/util/errors'
import {printOutstandingRPCs} from '@/local-debug'
import type {CommonResponseHandler, WaitingKey} from './types'
import {wrapErrors} from '@/util/debug'
import type {ErrorType} from './rpc-transport'

// Wraps a response to update the waiting state
const makeWaitingResponse = (r?: Partial<CommonResponseHandler>, waitingKey?: WaitingKey) => {
  if (!r || !waitingKey) {
    return r
  }

  const response: Partial<CommonResponseHandler> = {}

  if (r.error) {
    response.error = (e: ErrorType) => {
      // Waiting on the server again
      getEngine().dispatchWaitingAction(waitingKey, true)
      r.error?.(e)
    }
  }

  if (r.result) {
    response.result = (...args: Array<unknown>) => {
      // Waiting on the server again
      getEngine().dispatchWaitingAction(waitingKey, true)
      r.result?.(...args)
    }
  }

  return response
}

async function listener(p: {
  method: string
  params?: object
  incomingCallMap?: {[K in string]: (params: unknown) => Promise<void>}
  customResponseIncomingCallMap?: {
    [K in string]: (params: unknown, response: Partial<CommonResponseHandler>) => Promise<void>
  }
  waitingKey?: WaitingKey
}) {
  return new Promise((resolve, reject) => {
    const {method, params, waitingKey} = p
    const incomingCallMap = p.incomingCallMap || {}
    const customResponseIncomingCallMap = p.customResponseIncomingCallMap || {}

    // Waiting on the server
    if (waitingKey) {
      getEngine().dispatchWaitingAction(waitingKey, true)
    }

    const makeHandler = (method: string, custom: boolean) => {
      return (params: unknown, _response: CommonResponseHandler) => {
        // No longer waiting on the server
        if (waitingKey) {
          getEngine().dispatchWaitingAction(waitingKey, false)
        }

        let response = makeWaitingResponse(_response, waitingKey)

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

    getEngine()._rpcOutgoing({
      callback: (error?: RPCError, params?: unknown) => {
        if (printOutstandingRPCs) {
          clearInterval(outstandingIntervalID)
        }

        if (waitingKey) {
          // No longer waiting
          getEngine().dispatchWaitingAction(waitingKey, false, error instanceof RPCError ? error : undefined)
        }

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
  })
}

export default listener
