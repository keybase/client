'use strict'
/* @flow */

import { combineReducers } from 'redux'
import login from './login'
// $FlowFixMe login2 isnt typed
import login2 from './login2'
import devices from './devices'
import search from './search'
import profile from './profile'
import config from './config'
import tabbedRouter from './tabbed-router'
import {List} from 'immutable'
import type { State } from '../constants/reducer-types'
import serialize from './serialize'

let history = List()
let index = 0

function timeTravel (state: State, action: any): State {
  if (action.type !== 'timetravel') {
    history = history.slice(0, index + 1).push(state)
    index = history.size - 1
    return state
  } else {
    const { direction } = action.payload

    if (direction === 'back') {
      return history.get(--index, state)
    }
    return history.get(++index, state)
  }
}

const reducer = combineReducers({
  login,
  login2,
  devices,
  tabbedRouter,
  search,
  profile,
  config
})

export default function (state: State, action: any): State {
  const nextState = reducer(state, action)

  // TODO move this __DEV__ to a module
  if (__DEV__) { // eslint-disable-line no-undef
    return serialize(timeTravel(nextState, action), action)
  }

  return nextState
}
