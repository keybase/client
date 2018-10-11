// @flow
import {connect, isMobile} from '../../../util/container'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import Header from '.'

const mapStateToProps = state => {
  const selectedAccount = Constants.getAccount(state)
  return {
    accountID: selectedAccount.accountID,
    isDefaultWallet: selectedAccount.isDefault,
    keybaseUser: state.config.username,
    walletName: selectedAccount.name,
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onGoToSendReceive: (from: string, recipientType: Types.CounterpartyType, isRequest: boolean) => {
    dispatch(WalletsGen.createClearBuilding())
    dispatch(isRequest ? WalletsGen.createClearBuiltRequest() : WalletsGen.createClearBuiltPayment())
    dispatch(WalletsGen.createClearErrors())
    dispatch(WalletsGen.createSetBuildingIsRequest({isRequest}))
    dispatch(WalletsGen.createSetBuildingRecipientType({recipientType}))
    dispatch(WalletsGen.createSetBuildingFrom({from}))
    dispatch(
      ownProps.navigateAppend([
        {
          selected: Constants.sendReceiveFormRouteKey,
        },
      ])
    )
  },
  _onReceive: (accountID: Types.AccountID) =>
    dispatch(
      ownProps.navigateAppend([
        {
          props: {accountID},
          selected: 'receive',
        },
      ])
    ),
  _onShowSecretKey: (accountID: Types.AccountID, walletName: ?string) =>
    dispatch(
      ownProps.navigateAppend([
        {
          props: {accountID, walletName},
          selected: 'exportSecretKey',
        },
      ])
    ),
  _onSettings: (accountID: Types.AccountID) =>
    dispatch(
      ownProps.navigateAppend([
        {
          props: {accountID},
          selected: 'settings',
        },
      ])
    ),
  onBack: isMobile ? () => dispatch(ownProps.navigateUp()) : null,
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  onBack: dispatchProps.onBack,
  onReceive: () => dispatchProps._onReceive(stateProps.accountID),
  onRequest: () => dispatchProps._onGoToSendReceive(stateProps.accountID, 'keybaseUser', true),
  onSendToAnotherAccount: () => dispatchProps._onGoToSendReceive(stateProps.accountID, 'otherAccount', false),
  onSendToKeybaseUser: () => dispatchProps._onGoToSendReceive(stateProps.accountID, 'keybaseUser', false),
  onSendToStellarAddress: () =>
    dispatchProps._onGoToSendReceive(stateProps.accountID, 'stellarPublicKey', false),
  onShowSecretKey: () => dispatchProps._onShowSecretKey(stateProps.accountID, stateProps.walletName),
  onSettings: () => dispatchProps._onSettings(stateProps.accountID),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Header)
