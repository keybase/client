/* @flow */

import * as Constants from '../constants/pgp'
import * as CommonConstants from '../constants/common'
import type {Actions} from '../constants/pgp'

export type State = {
  open: boolean,
}

const initialState: State = {
  open: false,
}

export default function (state: State = initialState, action: Actions): State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {
        ...initialState,
      }

    case Constants.pgpKeyInSecretStoreFile:
      return {
        ...state,
        open: true,
      }
    case Constants.pgpAckedMessage:
      return {
        ...state,
        open: false,
      }
  }
  return state
}

