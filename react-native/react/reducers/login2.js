'use strict'

import * as Constants from '../constants/login2'
import Immutable from 'immutable'

const initialState = {
  username: '',
  passphrase: '',
  codePage: {
    myRole: null,
    otherRole: null
  }
}

export default function (state = initialState, action) {
  switch (action.type) {
    case Constants.actionSubmitUserPass:
      return {
        ...state,
        username: action.username,
        passphrase: action.passphrase
      }
    case Constants.setCodeState:
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          ...action
        }
      }).toJS()
    default:
      return state
  }
}
