// @flow
import {connect, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import Header from './header'

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
const mapDispatchToProps = (dispatch: Dispatch, ownProps) => ({
  _onReceive: (accountID: Types.AccountID) =>
    dispatch(
      ownProps.navigateAppend([
        {
          props: {accountID},
          selected: 'receive',
        },
      ])
    ),
  onDeposit: nyi,
  onSendToAnotherWallet: nyi,
  onSendToKeybaseUser: nyi,
  onSendToStellarAddress: nyi,
  onSettings: nyi,
  onShowSecretKey: nyi,
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  onReceive: () => dispatchProps._onReceive(stateProps.accountID),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Header)
