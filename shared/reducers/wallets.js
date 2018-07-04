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
    case WalletsGen.secretKeyReceived:
      return state.setIn(['secretKeyMap', action.payload.accountID], action.payload.secretKey)
    case WalletsGen.secretKeySeen:
      return state.set('secretKeyMap', I.Map())
    case WalletsGen.selectAccount:
      return state.set('selectedAccount', action.payload.accountID)
    // Saga only actions
    case WalletsGen.exportSecretKey:
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
