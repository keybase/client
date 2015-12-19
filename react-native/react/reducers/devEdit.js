/* @flow */

import type {State} from '../constants/reducer'

function updateInKeypath (map: Object | Array<any>, keyPath: Array<String>, v: any): Object | Array<any> {
  const frontKey = keyPath[0]
  var copy
  if (keyPath.length === 1) {
    if (map.constructor === Array) {
      copy = [].concat(map)
      copy[frontKey] = v
      return copy
    }
    return {...map, [frontKey]: v}
  }

  if (map.constructor === Array) {
    copy = [].concat(map)
    copy[frontKey] = updateInKeypath(copy[frontKey], keyPath.slice(1), v)
    return copy
  }
  return {...map, [frontKey]: updateInKeypath(map[frontKey], keyPath.slice(1), v)}
}

export default function (state: State, action: any): State {
  if (action.type === 'dev:devEdit') {
    const keyPath = [].concat(action.payload.keyPath)
    const newValue = action.payload.newValue
    console.log('hacking dev stuff')

    return updateInKeypath(state, keyPath, newValue)
  }
  return state
}

export function devEditAction (keyPath, newValue) {
  return {
    type: 'dev:devEdit',
    payload: {keyPath, newValue}
  }
}
