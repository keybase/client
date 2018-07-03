// @flow
// Helper to deal with service calls in a saga friendly way
import {getEngine, Engine} from '../engine'
import * as RS from 'redux-saga'
import * as RSE from 'redux-saga/effects'
import {sequentially} from '../util/saga'
import type {CommonResponseHandler, RPCError} from './types'
import type {TypedState} from '../constants/reducer'
import {printOutstandingRPCs} from '../local-debug'
import {isArray} from 'lodash'

type EmittedCall = {
  method: string,
  params: any,
  response?: CommonResponseHandler,
}

type EmittedFinished = {
  method: null,
  params: any,
  error: ?RPCError,
}

type CallbackWithResponse = (any, CommonResponseHandler, TypedState) => ?RS.Effect | ?Generator<any, any, any>
type CallbackNoResponse = (any, TypedState) => ?RS.Effect | ?Generator<any, any, any>

// TODO could have a mechanism to ensure only one is in flight at a time. maybe by some key or something
function* call(p: {
  method: string,
  params: Object,
  incomingCallMap: {[method: string]: any}, // this is typed by the generated helpers
  waitingKey?: string,
}): Generator<any, any, any> {
  const {method, params, incomingCallMap, waitingKey} = p
  const engine = getEngine()

  if (waitingKey) {
    Engine.dispatchWaitingAction(waitingKey, true)
  }

  const buffer = RS.buffers.expanding(10)

  // Event channel lets you use emitter to 'put' things onto a channel in a callback compatible form
  const eventChannel: RS.Channel = yield RS.eventChannel(emitter => {
    // convert call map
    const callMap = Object.keys(incomingCallMap).reduce((map, method) => {
      map[method] = (params: any, response: CommonResponseHandler) => {
        // If we need a custom reply we pass it down to the action handler to deal with, otherwise by default we handle it immediately
        const customResponseNeeded = incomingCallMap[method].length === 3
        if (!customResponseNeeded && response) {
          response.result()
        }

        // defer to process network first
        setTimeout(() => {
          const toEmit: EmittedCall = {
            method,
            params,
            ...(customResponseNeeded ? {response} : {}),
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

    engine._rpcOutgoing({
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

    return () => {}
  }, buffer) // allow the buffer to grow always

  let finalParams: any
  let finalError: ?RPCError
  try {
    while (true) {
      // Take things that we put into the eventChannel above
      const r = yield RSE.take(eventChannel)

      if (r.method) {
        const res: EmittedCall = (r: EmittedCall)
        // See if its handled
        const cb = incomingCallMap[res.method]
        if (cb) {
          const state: TypedState = yield RSE.select()
          let actions

          if (res.response) {
            const c: CallbackWithResponse = (cb: CallbackWithResponse)
            actions = yield RSE.call(c, res.params, res.response, state)
          } else {
            const c: CallbackNoResponse = (cb: CallbackNoResponse)
            actions = yield RSE.call(c, res.params, state)
          }

          if (actions) {
            if (isArray(actions)) {
              yield sequentially(actions.filter(Boolean))
            } else {
              yield actions
            }
          }
        }
      } else {
        const res: EmittedFinished = (r: EmittedFinished)
        // finished
        finalParams = res.params
        finalError = res.error
      }
    }
  } finally {
    // eventChannel will jump to finally when RS.END is emitted
    if (waitingKey) {
      Engine.dispatchWaitingAction(waitingKey, false)
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
