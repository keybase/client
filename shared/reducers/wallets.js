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
    case WalletsGen.walletsReceived:
      const walletMap = I.Map(action.payload.wallets.map(wallet => [wallet.accountID, wallet]))
      return state.set('walletMap', walletMap)
    case WalletsGen.assetsReceived:
      const {assets} = action.payload
      return state.update('assetsMap', assetsMap => assetsMap.set(action.payload.accountID, assets))
    case WalletsGen.paymentsReceived:
      console.warn('in payments received', action.payload)
      const {payments} = action.payload
      return state.update('paymentsMap', paymentsMap => paymentsMap.set(action.payload.accountID, payments))
    // Saga only actions
    case WalletsGen.loadAllAssets:
    case WalletsGen.loadAssets:
    case WalletsGen.walletsRefresh:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
