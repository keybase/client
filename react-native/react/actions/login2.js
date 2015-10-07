'use strict'

import * as Constants from '../constants/login2'

export function welcomeSubmitUserPass (username, passphrase) {
  return {
    type: Constants.actionSubmitUserPass,
    username,
    passphrase
  }
}
