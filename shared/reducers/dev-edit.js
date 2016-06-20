/* @flow */

import {Iterable} from 'immutable'
import type {State} from '../constants/reducer'
import type {Action} from '../constants/types/flux'

function updateInKeypath (map: any, keyPath: Array<String | number>, v: any): any {
  const frontKey = keyPath[0]
  var copy: any
  if (keyPath.length === 1) {
    if (map.constructor === Array) {
      copy = [].concat(map)
      if (typeof frontKey === 'number') {
        copy[frontKey] = v
      } else {
        console.warn('Accessing an array without a number')
      }
      return copy
    } else if (Iterable.isIterable(map)) {
      return map.set(frontKey, v)
    }

    return {...map, [frontKey]: v}
  }

  if (map.constructor === Array) {
    copy = [].concat(map)
    if (typeof frontKey === 'number') {
      copy[frontKey] = updateInKeypath(copy[frontKey], keyPath.slice(1), v)
    } else {
      console.warn('Accessing an array without a number')
    }
    return copy
  } else if (Iterable.isIterable(map)) {
    return map.setIn(keyPath, v)
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

export function devEditAction (keyPath: Array<String>, newValue: any): Action {
  return {
    type: 'dev:devEdit',
    payload: {keyPath, newValue},
  }
}
