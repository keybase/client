'use strict'

import * as Constants from '../constants/login2'

export function welcomeExpand (section) {
  return {
    type: Constants.actionWindowExpand,
    section
  }
}

export function welcomeSubmitUserPass (username, passphrase) {
  return {
    type: Constants.actionSubmitUserPass,
    username,
    passphrase
  }
}
