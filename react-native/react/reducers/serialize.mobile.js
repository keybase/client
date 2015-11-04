'use strict'
/* @flow */

import { AsyncStorage } from 'react-native'
import type { State } from '../constants/reducer-types'
import { STATE_KEY } from '../constants/reducer-types'
import transit from 'transit-immutable-js'

import { SERIALIZE_RESTORE, SERIALIZE_SAVE } from '../constants/dev'

export default function (state: State, action: any): State {
  if (action.type === SERIALIZE_RESTORE) {
    console.log('restoring state')
    return transit.fromJSON(action.payload)
  } else if (action.type === SERIALIZE_SAVE) {
    console.log('saving state')
    AsyncStorage.setItem(STATE_KEY, transit.toJSON(state))
  }
  return state
}
