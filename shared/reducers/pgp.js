// @flow
import * as Constants from '../constants/pgp'
import * as PgpGen from '../actions/pgp-gen'

export default function(
  state: Constants.State = Constants.initialState,
  action: PgpGen.Actions
): Constants.State {
  switch (action.type) {
    case PgpGen.resetStore:
      return {...Constants.initialState}

    case PgpGen.pgpKeyInSecretStoreFile:
      return {
        ...state,
        open: true,
      }
    case PgpGen.pgpAckedMessage:
      return {
        ...state,
        open: false,
      }
  }
  return state
}
