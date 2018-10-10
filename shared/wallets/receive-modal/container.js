// @flow
import {connect, isMobile} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {walletsTab, settingsTab} from '../../constants/tabs'
import {walletsTab as walletsSettingsTab} from '../../constants/settings'
import Receive from '.'

export type OwnProps = {
  accountID: Types.AccountID,
}

const mapStateToProps = (state, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  const account = Constants.getAccount(state, accountID)
  return {
    accountName: account.name || `${state.config.username}'s account`,
    federatedAddress: Constants.getFederatedAddress(state, accountID),
    isDefaultAccount: account.isDefault,
    stellarAddress: accountID,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => ({
  navigateUp: () => dispatch(navigateUp()),
  onRequest: () => {
    const accountID = routeProps.get('accountID')
    dispatch(WalletsGen.createSetBuildingFrom({from: accountID}))
    // TODO DESKTOP-7961 navigate to separate receive form
    dispatch(
      RouteTreeGen.createNavigateTo({
        parentPath: [...(isMobile ? [settingsTab, walletsSettingsTab] : [walletsTab]), 'wallet'],
        path: [{props: {isRequest: true}, selected: Constants.sendReceiveFormRouteKey}],
      })
    )
  },
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  onClose: dispatchProps.navigateUp,
  onRequest: dispatchProps.onRequest,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Receive)
