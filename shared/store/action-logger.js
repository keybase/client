import Immutable from 'immutable'
import {forwardLogs, enableActionLogging, immediateStateLogging} from '../local-debug'

function makeActionToLog(action, oldState) {
  if (action.logTransformer) {
    try {
      return action.logTransformer(action, oldState)
    } catch (e) {
      console.warn('Action logger error', e)
    }
  }
}

// Transform objects from Immutable on printing
const objToJS = state => {
  var newState = {}

  Object.keys(state).forEach(i => {
    if (Immutable.Iterable.isIterable(state[i])) {
      newState[i] = state[i].toJS()
    } else {
      newState[i] = state[i]
    }
  })

  return newState
}

export const actionLogger = store => next => action => {
  console.groupCollapsed(`Dispatching action: ${action.type}`)

  console.log(`Dispatching action: ${action.type}: ${JSON.stringify(action)} `)
  let result = next(action)

  console.log('Next state:', JSON.stringify(objToJS(store.getState())))
  console.groupEnd()
  return result
}
