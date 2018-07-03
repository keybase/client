// @flow
import * as I from 'immutable'
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as WalletsGen from '../actions/wallets-gen'

const initialState: Types.State = Constants.makeState()

export default function(state: Types.State = initialState, action: WalletsGen.Actions) {
  switch (action.type) {
    case WalletsGen.resetStore:
      return initialState
    case WalletsGen.accountsReceived:
      const accountMap = I.Map(action.payload.accounts.map(account => [account.accountID, account]))
      return state.set('accountMap', accountMap)
    case WalletsGen.assetsReceived:
      return state.setIn(['assetsMap', action.payload.accountID], I.List(action.payload.assets))
    case WalletsGen.paymentsReceived:
      return state.setIn(['paymentsMap', action.payload.accountID], I.List(action.payload.payments))
    case WalletsGen.selectAccount:
      return state.set('selectedAccount', action.payload.accountID)
    case WalletsGen.validateAccountName:
      return action.error
        ? state
            .set('accountNameError', action.payload.error)
            .set('accountNameValidationState', action.payload.error ? 'error' : 'valid')
        : state.set('accountNameValidationState', 'waiting')
    case WalletsGen.validateSecretKey:
      return action.error
        ? state
            .set('secretKeyError', action.payload.error)
            .set('secretKeyValidationState', action.payload.error ? 'error' : 'valid')
        : state.set('secretKeyValidationState', 'waiting')
    case WalletsGen.clearErrors:
      return state
        .set('secretKeyError', '')
        .set('secretKeyValidationState', 'none')
        .set('accountNameError', '')
        .set('accountNameValidationState', 'none')
        .set('linkExistingAccountError', '')
    case WalletsGen.linkExistingAccount:
      return action.error
        ? state.set('linkExistingAccountError', action.payload.error)
        : state.set('linkExistingAccountError', '')
    // Saga only actions
    case WalletsGen.loadAssets:
    case WalletsGen.loadPayments:
    case WalletsGen.loadAccounts:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
