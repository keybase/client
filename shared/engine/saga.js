// @flow
import {getEngine} from '../engine'
import * as RS from 'redux-saga'
import * as RSE from 'redux-saga/effects'
import {type TypedState} from '../constants/reducers'

// TODO generate calls
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

  const eventChannel = yield RS.eventChannel(emitter => {
    // convert call map
    const callMap = Object.keys(incomingCallMap).reduce((map, method) => {
      map[method] = (params, response) => {
        console.log('aaa in callMap', method, params, response)
        // incomingCallMap[key](emitter, ...args)
        // Reply immediately
        if (response) {
          response.result()
        }

        emitter({method, params})
      }
      return map
    }, {})

    engine._rpcOutgoing(
      method,
      {
        ...param,
        incomingCallMap: callMap,
      },
      () => {
        emitter(RS.END)
      } // done
    )

    return () => {}
  }, RS.buffers.expanding(10))

  try {
    while (true) {
      console.log('aaa in loop waiting')
      const res = yield RSE.take(eventChannel)
      console.log('aaa in loop took', res)
      if (res.method) {
        const cb = incomingCallMap[res.method]
        if (cb) {
          console.log('aaa in loop doing cb', res)
          const state: TypedState = yield RSE.select()
          const action = yield RSE.call(cb, res.params, state)
          console.log('aaa in loop after cb action', action)
          if (action) {
            yield action
          }
          console.log('aaa in loop after cb loop', res)
        } else {
          console.log('aaa in loop skipping cb due to missing key', res)
        }
      }
      // we responded and we're waiting again
      if (waitingActionCreator) {
        yield RSE.put(waitingActionCreator(true))
      }
    }
  } finally {
    console.log('aaa after loop due to end')
    // got END
    if (waitingActionCreator) {
      RSE.put(waitingActionCreator(false))
    }
  }
}

export default call
