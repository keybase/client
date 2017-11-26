// @flow
import * as Types from '../constants/types/pgp'
import * as Constants from '../constants/pgp'
import * as PgpGen from '../actions/pgp-gen'

export default function(state: Types.State = Constants.initialState, action: PgpGen.Actions): Types.State {
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
