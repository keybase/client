// @flow
// Helper to deal with service calls in a saga friendly way
import {getEngine} from '../engine'
import * as RS from 'redux-saga'
import * as RSE from 'redux-saga/effects'
import {type TypedState} from '../constants/reducer'

// TODO generate calls
// TODO flow type
function* call(
  method: string,
  param: Object,
  incomingCallMap: any,
  waitingActionCreator?: (waiting: boolean) => any
) {
  const engine = getEngine()
  if (waitingActionCreator) {
    yield RSE.put(waitingActionCreator(true))
  }

  // Event channel lets you use emitter to 'put' things onto a channel in a callback compatible form
  const eventChannel = yield RS.eventChannel(emitter => {
    // convert call map
    const callMap = Object.keys(incomingCallMap).reduce((map, method) => {
      map[method] = (params, response) => {
        // Reply immediately always
        if (response) {
          response.result()
        }

        emitter({method, params})
      }
      return map
    }, {})

    // Make the actual call
    engine._rpcOutgoing(
      method,
      {
        ...param,
        incomingCallMap: callMap,
      },
      () => {
        // When done send the special flag
        emitter(RS.END)
      }
    )

    return () => {}
  }, RS.buffers.expanding(10)) // allow the buffer to grow always

  try {
    while (true) {
      // Take things that we put into the eventChannel above
      const res = yield RSE.take(eventChannel)
      if (res.method) {
        // See if its handled
        const cb = incomingCallMap[res.method]
        if (cb) {
          let action
          // If they want state get it first
          if (cb.length === 2) {
            const state: TypedState = yield RSE.select()
            action = yield RSE.call(cb, res.params, state)
          } else {
            action = yield RSE.call(cb, res.params)
          }

          if (action) {
            yield action
          }
        }
      }
    }
  } finally {
    // eventChannel will jump to finally when RS.END is emitted
    if (waitingActionCreator) {
      yield RSE.put(waitingActionCreator(false))
    }
  }
}

export default call
