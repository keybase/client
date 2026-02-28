import type * as Framed from 'framed-msgpack-rpc'
import {getEngine} from './require'
import {RPCError} from '@/util/errors'
import {printOutstandingRPCs} from '@/local-debug'
import type {CommonResponseHandler} from './types'
import {wrapErrors} from '@/util/debug'

type WaitingKey = string | Array<string>

// Wraps a response to update the waiting state
const makeWaitingResponse = (_r?: Partial<CommonResponseHandler>, waitingKey?: WaitingKey) => {
  const r = _r
  if (!r || !waitingKey) {
    return r
  }

  const response: Partial<CommonResponseHandler> = {}

  if (r.error) {
    response.error = (e: Framed.ErrorType) => {
      // Waiting on the server again
      if (waitingKey) {
        getEngine().dispatchWaitingAction(waitingKey, true)
      }
      r.error?.(e)
    }
  }

  if (r.result) {
    response.result = (...args: Array<unknown>) => {
      // Waiting on the server again
      if (waitingKey) {
        getEngine().dispatchWaitingAction(waitingKey, true)
      }
      r.result?.(...args)
    }
  }

  return response
}

// TODO could have a mechanism to ensure only one is in flight at a time. maybe by some key or something
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

    // custom and normal incomingCallMaps
    const bothCallMaps = [
      ...Object.keys(incomingCallMap).map(method => ({custom: false, method})),
      ...Object.keys(customResponseIncomingCallMap).map(method => ({custom: true, method})),
    ]

    // Waiting on the server
    if (waitingKey) {
      getEngine().dispatchWaitingAction(waitingKey, true)
    }

    const callMap = bothCallMaps.reduce((map: {[key: string]: unknown}, {method, custom}) => {
      map[method] = (params: unknown, _response: CommonResponseHandler) => {
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

        // defer to process network first
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

          invokeAndDispatch()
            .then(() => {})
            .catch(() => {})
        }, 5)
      }
      return map
    }, {})

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
          reject(error)
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
