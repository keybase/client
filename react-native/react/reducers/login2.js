'use strict'

import * as Constants from '../constants/login2'

// TODO load this off of the init

const initialState = {
  welcomeExpanded: 'loginExpanded',// null,
  username: 'Caley',
  usernames: ['Chris', 'Caley', 'Cecile']
}

export default function (state = initialState, action) {
  switch (action.type) {
    case Constants.actionWindowExpand:
      return {
        ...state,
        welcomeExpanded: action.section
      }
    default:
      return state
  }
}
