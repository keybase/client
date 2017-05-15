// @flow
import * as Constants from '../constants/pgp'
import * as CommonConstants from '../constants/common'

const initialState: Constants.State = {
  open: false,
}

export default function(
  state: Constants.State = initialState,
  action: Constants.Actions
): Constants.State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}

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
