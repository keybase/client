'use strict'

import * as Constants from '../constants/login2'

const initialState = {
  username: '',
  passphrase: ''
}

export default function (state = initialState, action) {
  switch (action.type) {
    case Constants.actionSubmitUserPass:
      return {
        ...state,
        username: action.username,
        passphrase: action.passphrase
      }
    default:
      return state
  }
}
