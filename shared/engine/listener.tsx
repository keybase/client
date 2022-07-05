// similar to the old engine saga helper but for the redux toolkit listener flows
import {getEngine} from './require'
import {RPCError} from '../util/errors'
import {printOutstandingRPCs} from '../local-debug'
import type {CommonResponseHandler} from './types'
import isArray from 'lodash/isArray'
import type {ListenerApi} from '../util/redux-toolkit'

type WaitingKey = string | Array<string>

// Wraps a response to update the waiting state
const makeWaitingResponse = (r: CommonResponseHandler, waitingKey?: WaitingKey) => {
  if (!r || !waitingKey) {
    return r
  }

  const response: any = {}

  if (r.error) {
    // @ts-ignore codemode issue
    response.error = (...args: Array<any>) => {
      // Waiting on the server again
      if (waitingKey) {
        getEngine().dispatchWaitingAction(waitingKey, true, null)
      }
      // @ts-ignore
      r.error(...args)
    }
  }

  if (r.result) {
    // @ts-ignore codemode issue
    response.result = (...args) => {
      // Waiting on the server again
      if (waitingKey) {
        getEngine().dispatchWaitingAction(waitingKey, true, null)
      }
      r.result(...args)
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
      ...Object.keys(incomingCallMap).map(method => ({
        custom: false,
        handler: incomingCallMap[method],
        method,
      })),
      ...Object.keys(customResponseIncomingCallMap).map(method => ({
        custom: true,
        handler: customResponseIncomingCallMap[method],
        method,
      })),
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
            response.result()
            response = null
          }
        }

        // defer to process network first
        setTimeout(() => {
          const invokeAndDispatch = async () => {
            let actions: Array<any> = []
            if (response) {
              const cb = customResponseIncomingCallMap[method]
              if (cb) {
                actions = await cb(params, response)
              }
            } else {
              const cb = incomingCallMap[method]
              if (cb) {
                actions = await cb(params)
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
        console.log('Engine/Saga with a still-alive eventChannel for method:', method)
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
      incomingCallMap: callMap,
      method,
      params,
    })

    // let finalParams: any
    // let finalError: RPCError | null | Error = null
    // try {
    //   while (true) {
    //     // Take things that we put into the eventChannel above
    //     const r = yield RSE.take(eventChannel)

    //     if (r.method) {
    //       const res: EmittedCall = r as EmittedCall
    //       let actions

    //       if (res.response) {
    //         const cb = customResponseIncomingCallMap[r.method]
    //         if (cb) {
    //           actions = yield RSE.call(cb, res.params, res.response)
    //         }
    //       } else {
    //         const cb = incomingCallMap[r.method]
    //         if (cb) {
    //           actions = yield RSE.call(cb, res.params)
    //         }
    //       }

    //       if (actions) {
    //         if (isArray(actions)) {
    //           yield sequentially(actions.filter(Boolean))
    //         } else {
    //           yield actions
    //         }
    //       }
    //     } else {
    //       const res: EmittedFinished = r as EmittedFinished
    //       // finished
    //       finalParams = res.params
    //       finalError = res.error
    //     }
    //   }
    // } catch (error_) {
    //   const error = error_ as any
    //   // capture errors when we handle the callbacks and treat the whole process as an error
    //   finalError = error
    // } finally {
    //   // eventChannel will jump to finally when RS.END is emitted
    //   if (waitingKey) {
    //     // No longer waiting
    //     getEngine().dispatchWaitingAction(waitingKey, false, finalError instanceof RPCError ? finalError : null)
    //   }

    //   if (finalError) {
    //     // eslint-disable-next-line no-unsafe-finally
    //     throw finalError
    //   }

    //   // eslint-disable-next-line no-unsafe-finally
    //   return finalParams
    // }
  })
}

export default listener
