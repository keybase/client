// @flow
import {connect, type TypedState, isMobile} from '../../../util/container'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import Header from '.'

const mapStateToProps = (state: TypedState) => {
  const selectedAccount = Constants.getAccount(state)
  return {
    accountID: selectedAccount.accountID,
    isDefaultWallet: selectedAccount.isDefault,
    keybaseUser: state.config.username,
    walletName: Constants.getAccountName(selectedAccount),
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onGoToSendReceive: (from: string, recipientType: Types.CounterpartyType) => {
    dispatch(WalletsGen.createClearBuildingPayment())
    dispatch(WalletsGen.createClearBuiltPayment())
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
  onSendToAnotherAccount: () => dispatchProps._onGoToSendReceive(stateProps.accountID, 'otherAccount'),
  onSendToKeybaseUser: () => dispatchProps._onGoToSendReceive(stateProps.accountID, 'keybaseUser'),
  onSendToStellarAddress: () => dispatchProps._onGoToSendReceive(stateProps.accountID, 'stellarPublicKey'),
  onShowSecretKey: () => dispatchProps._onShowSecretKey(stateProps.accountID, stateProps.walletName),
  onSettings: () => dispatchProps._onSettings(stateProps.accountID),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Header)
