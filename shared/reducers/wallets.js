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
    case WalletsGen.walletsRefresh:
      return state
    case WalletsGen.walletsReceived:
      console.warn('a', action)
      const walletMap = I.Map(action.payload.wallets.map(wallet =>
        [ wallet.accountID, wallet ]
      ))
      console.warn(walletMap)
      return state.set('walletMap', walletMap)
    // Saga only actions
    // case WalletsGen.somethingElse:
    // return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
