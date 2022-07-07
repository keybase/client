// similar to the old engine saga helper but for the redux toolkit listener flows
import {getEngine} from './require'
import {RPCError} from '../util/errors'
import {printOutstandingRPCs} from '../local-debug'
import type {CommonResponseHandler} from './types'
import isArray from 'lodash/isArray'
import type {ListenerApi} from '../util/redux-toolkit'
import type {TypedActions} from '../actions/typed-actions-gen'

type WaitingKey = string | Array<string>

// Wraps a response to update the waiting state
const makeWaitingResponse = (_r?: Partial<CommonResponseHandler>, waitingKey?: WaitingKey) => {
  const r = _r
  if (!r || !waitingKey) {
    return r
  }

  const response: Partial<CommonResponseHandler> = {}

  if (r.error) {
    response.error = (...args: Array<unknown>) => {
      // Waiting on the server again
      if (waitingKey) {
        getEngine().dispatchWaitingAction(waitingKey, true, null)
      }
      // @ts-ignore
      r.error?.(...args)
    }
  }

  if (r.result) {
    response.result = (...args: Array<unknown>) => {
      // Waiting on the server again
      if (waitingKey) {
        getEngine().dispatchWaitingAction(waitingKey, true, null)
      }
      r.result?.(...args)
    }
  }

  return response
}

// TODO could have a mechanism to ensure only one is in flight at a time. maybe by some key or something
async function listener(
  p: {
    method: string
    params: Object | null
    incomingCallMap?: {[K in string]: any}
    customResponseIncomingCallMap?: {[K in string]: any}
    waitingKey?: WaitingKey
  },
  listenerApi: ListenerApi
) {
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
      getEngine().dispatchWaitingAction(waitingKey, true, null)
    }

    const callMap = bothCallMaps.reduce((map, {method, custom}) => {
      map[method] = (params: any, _response: CommonResponseHandler) => {
        // No longer waiting on the server
        if (waitingKey) {
          getEngine().dispatchWaitingAction(waitingKey, false, null)
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
          const invokeAndDispatch = async () => {
            let actions: Array<TypedActions | false> = []
            if (response) {
              const cb = customResponseIncomingCallMap[method]
              if (cb) {
                actions = await cb(params, response, listenerApi)
              }
            } else {
              const cb = incomingCallMap[method]
              if (cb) {
                actions = await cb(params, listenerApi)
              }
            }

            const arr = isArray(actions) ? actions : [actions]
            for (const act of arr) {
              act && listenerApi.dispatch(act)
            }
          }

          invokeAndDispatch()
            .then(() => {})
            .catch(() => {})
        }, 5)
      }
      return map
    }, {})

    // Make the actual call
    let outstandingIntervalID
    if (printOutstandingRPCs) {
      outstandingIntervalID = setInterval(() => {
        console.log('Engine/Listener with a still-alive eventChannel for method:', method)
      }, 2000)
    }

    getEngine()._rpcOutgoing({
      callback: (error?: RPCError, params?: any) => {
        if (printOutstandingRPCs) {
          clearInterval(outstandingIntervalID)
        }

        if (waitingKey) {
          // No longer waiting
          getEngine().dispatchWaitingAction(waitingKey, false, error instanceof RPCError ? error : null)
        }

        if (error) {
          reject(error)
        } else {
          resolve(params)
        }
      },
      // @ts-ignore TODO
      incomingCallMap: callMap,
      method,
      params,
    })
  })
}

export default listener
