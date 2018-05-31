// @flow
// Helper to deal with service calls in a saga friendly way
import {getEngine} from '../engine'
import * as RS from 'redux-saga'
import * as RSE from 'redux-saga/effects'
import {type TypedState} from '../constants/reducer'
import {printOutstandingRPCs} from '../local-debug'

// TODO could have a mechanism to ensure only one is in flight at a time. maybe by some key or something
function* call(
  method: string,
  param: Object,
  incomingCallMap: {[method: string]: any}, // this is typed by the generated helpers
  waitingActionCreator?: (waiting: boolean) => any
): Generator<any, any, any> {
  const engine = getEngine()

  if (waitingActionCreator) {
    yield RSE.put(waitingActionCreator(true))
  }

  // Event channel lets you use emitter to 'put' things onto a channel in a callback compatible form
  const eventChannel = yield RS.eventChannel(emitter => {
    // convert call map
    const callMap = Object.keys(incomingCallMap).reduce((map, method) => {
      map[method] = (params, response) => {
        // If we need a custom reply we pass it down to the action handler to deal with, otherwise by default we handle it immediately
        const customResponseNeeded = incomingCallMap[method].length === 3
        if (!customResponseNeeded && response) {
          response.result()
        }

        // defer to process network first
        setTimeout(() => {
          emitter({
            method,
            params,
            ...(customResponseNeeded ? {response} : {}),
          })
        }, 5)
      }
      return map
    }, {})

    // Make the actual call
    let intervalID
    if (printOutstandingRPCs) {
      intervalID = setInterval(() => {
        console.log('Engine/Saga with a still-alive eventChannel for method:', method)
      }, 2000)
    }

    engine._rpcOutgoing(
      method,
      {
        ...param,
        incomingCallMap: callMap,
      },
      (error, params) => {
        if (printOutstandingRPCs) {
          clearInterval(intervalID)
        }
        // When done send the special flag
        setTimeout(() => {
          emitter({error, method: null, params})
          emitter(RS.END)
        }, 5)
      }
    )

    return () => {}
  }, RS.buffers.expanding(10)) // allow the buffer to grow always

  let finalParams
  let finalError
  try {
    while (true) {
      // Take things that we put into the eventChannel above
      const res = yield RSE.take(eventChannel)

      if (res.method) {
        // See if its handled
        const cb = incomingCallMap[res.method]
        if (cb) {
          const state: TypedState = yield RSE.select()
          let action

          if (res.response) {
            action = yield RSE.call(cb, res.params, res.response, state)
          } else {
            action = yield RSE.call(cb, res.params, state)
          }

          if (action) {
            yield action
          }
        }
      } else {
        // finished
        finalParams = res.params
        finalError = res.error
      }
    }
  } finally {
    // eventChannel will jump to finally when RS.END is emitted
    if (waitingActionCreator) {
      yield RSE.put(waitingActionCreator(false))
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
