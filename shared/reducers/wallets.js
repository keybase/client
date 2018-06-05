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
      const {assets} = action.payload
      return state.update('assetsMap', assetsMap => assetsMap.set(action.payload.accountID, I.List(assets)))
    case WalletsGen.paymentsReceived:
      const {payments} = action.payload
      return state.update('paymentsMap', paymentsMap =>
        paymentsMap.set(action.payload.accountID, I.List(payments))
      )
    // Saga only actions
    case WalletsGen.loadEverything:
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
