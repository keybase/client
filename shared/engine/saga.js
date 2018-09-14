// @flow
// Helper to deal with service calls in a saga friendly way
import * as RS from 'redux-saga'
import * as RSE from 'redux-saga/effects'
import {getEngine} from './require'
import {sequentially} from '../util/saga'
import type {CommonResponseHandler, RPCError} from './types'
import {printOutstandingRPCs} from '../local-debug'
import {isArray} from 'lodash-es'

type EmittedCall = {
  method: string,
  params: any,
  response: ?CommonResponseHandler,
}

type EmittedFinished = {
  method: null,
  params: any,
  error: ?RPCError,
}

// Wraps a response to update the waiting state
const makeWaitingResponse = (r, waitingKey) => {
  if (!r || !waitingKey) {
    return r
  }

  const response = {}

  if (r.result) {
    response.error = (...args) => {
      // Waiting on the server again
      if (waitingKey) {
        getEngine().dispatchWaitingAction(waitingKey, true)
      }
      r.error(...args)
    }
  }

  if (r.error) {
    response.result = (...args) => {
      // Waiting on the server again
      if (waitingKey) {
        getEngine().dispatchWaitingAction(waitingKey, true)
      }
      r.result(...args)
    }
  }

  return response
}

// TODO could have a mechanism to ensure only one is in flight at a time. maybe by some key or something
function* call(p: {
  method: string,
  params: ?Object,
  incomingCallMap?: {[method: string]: any}, // this is typed by the generated helpers
  customResponseIncomingCallMap?: {[method: string]: any},
  waitingKey?: string,
}): Generator<any, any, any> {
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
    getEngine().dispatchWaitingAction(waitingKey, true)
  }

  const buffer = RS.buffers.expanding(10)

  // Event channel lets you use emitter to 'put' things onto a channel in a callback compatible form
  const eventChannel: RS.Channel = yield RS.eventChannel(emitter => {
    // convert call map
    const callMap = bothCallMaps.reduce((map, {method, custom, handler}) => {
      map[method] = (params: any, _response: CommonResponseHandler) => {
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
            response.result()
            response = null
          }
        }

        // defer to process network first
        setTimeout(() => {
          const toEmit: EmittedCall = {
            method,
            params,
            response,
          }
          emitter(toEmit)
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
      callback: (error?: RPCError, params: any) => {
        if (printOutstandingRPCs) {
          clearInterval(outstandingIntervalID)
        }

        const toEmit: EmittedFinished = {error, method: null, params}
        // Send results deferred
        setTimeout(() => {
          emitter(toEmit)
        }, 5)

        // Send end when our buffers are clear
        const endIntervalID = setInterval(() => {
          if (buffer.isEmpty()) {
            emitter(RS.END)
            clearInterval(endIntervalID)
          } else if (printOutstandingRPCs) {
            console.log('Engine/Saga waiting on buffer clear for method:', method)
          }
        }, 500)
      },
      incomingCallMap: callMap,
      method,
      params,
    })

    // Must return an unsubscribe function, we just ignore this
    return () => {}
  }, buffer) // allow the buffer to grow always

  let finalParams: any
  let finalError: ?RPCError | ?Error
  try {
    while (true) {
      // Take things that we put into the eventChannel above
      const r = yield RSE.take(eventChannel)

      if (r.method) {
        const res: EmittedCall = (r: EmittedCall)
        let actions

        if (res.response) {
          const cb = customResponseIncomingCallMap[r.method]
          if (cb) {
            actions = yield RSE.call(cb, res.params, res.response)
          }
        } else {
          const cb = incomingCallMap[r.method]
          if (cb) {
            actions = yield RSE.call(cb, res.params)
          }
        }

        if (actions) {
          if (isArray(actions)) {
            yield sequentially(actions.filter(Boolean))
          } else {
            yield actions
          }
        }
      } else {
        const res: EmittedFinished = (r: EmittedFinished)
        // finished
        finalParams = res.params
        finalError = res.error
      }
    }
  } catch (e) {
    // capture errors when we handle the callbacks and treat the whole process as an error
    finalError = e
  } finally {
    // eventChannel will jump to finally when RS.END is emitted
    if (waitingKey) {
      // No longer waiting
      getEngine().dispatchWaitingAction(waitingKey, false)
    }

    if (finalError) {
      // eslint-disable-next-line no-unsafe-finally
      throw finalError
    }

    // eslint-disable-next-line no-unsafe-finally
    return finalParams
  }
}

export default call
