import Immutable from 'immutable'
import jsondiffpatch from 'jsondiffpatch'

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

let logs = []
let startedLoop = false

export const actionLogger = store => next => action => {
  if (!startedLoop) {
    startedLoop = true
    setInterval(() => {
      if (!logs.length) return
      console.groupCollapsed && console.groupCollapsed('Actions: ' + logs.length)
      console.log(logs.join('\n'))
      logs = []
      console.groupEnd && console.groupEnd()
    }, 2000)
  }
  const old = objToJS(store.getState())

  let result = next(action)

  logs.push('Dispatching action: ' + action.type + ': ', JSON.stringify(action) + '\n' +
    'State diff: ' + JSON.stringify(jsondiffpatch.diff(old, objToJS(store.getState()))))

  return result
}
