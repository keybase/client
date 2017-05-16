// @flow
import {AsyncStorage} from 'react-native'
import type {State} from '../constants/reducer'
import {stateKey} from '../constants/reducer'
import transit from 'transit-immutable-js'

import {serializeRestore, serializeSave} from '../constants/dev'

export default function(state: State, action: any): State {
  if (action.type === serializeRestore) {
    console.log('restoring state')
    return transit.fromJSON(action.payload)
  } else if (action.type === serializeSave) {
    console.log('saving state')
    AsyncStorage.setItem(stateKey, transit.toJSON(state))
  }
  return state
}
