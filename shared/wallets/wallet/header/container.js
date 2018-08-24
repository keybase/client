// @flow
import {connect, type TypedState} from '../../../util/container'
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
    walletName: selectedAccount.name || Types.accountIDToString(selectedAccount.accountID),
  }
}

const nyi = () => console.log('Not yet implemented')

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onGoToSendReceive: (from: string, recipientType: Types.CounterpartyType) => {
    dispatch(WalletsGen.createClearBuildingPayment())
    dispatch(WalletsGen.createClearBuiltPayment())
    dispatch(WalletsGen.createSetBuildingRecipientType({recipientType}))
    dispatch(WalletsGen.createSetBuildingFrom({from}))
    dispatch(
      ownProps.navigateAppend([
        {
          selected: 'sendReceiveForm',
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
  _onShowSecretKey: (accountID: Types.AccountID) =>
    dispatch(
      ownProps.navigateAppend([
        {
          props: {accountID},
          selected: 'exportSecretKey',
        },
      ])
    ),
  onDeposit: nyi,
  onSettings: nyi,
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  onReceive: () => dispatchProps._onReceive(stateProps.accountID),
  onSendToAnotherAccount: () => dispatchProps._onGoToSendReceive(stateProps.accountID, 'otherAccount'),
  onSendToKeybaseUser: () => dispatchProps._onGoToSendReceive(stateProps.accountID, 'keybaseUser'),
  onSendToStellarAddress: () => dispatchProps._onGoToSendReceive(stateProps.accountID, 'stellarPublicKey'),
  onShowSecretKey: () => dispatchProps._onShowSecretKey(stateProps.accountID),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Header)
