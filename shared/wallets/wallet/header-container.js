// @flow
import {connect, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import Header from './header'

const mapStateToProps = (state: TypedState) => {
  const selectedAccount = Constants.getAccount(state)
  return {
    isDefaultWallet: selectedAccount.isDefault,
    keybaseUser: state.config.username,
    walletName: selectedAccount.name || Types.accountIDToString(selectedAccount.accountID),
  }
}

const nyi = () => console.log('Not yet implemented')
const mapDispatchToProps = (dispatch: Dispatch) => ({
  onDeposit: nyi,
  onReceive: nyi,
  onSendToAnotherWallet: nyi,
  onSendToKeybaseUser: nyi,
  onSendToStellarAddress: nyi,
  onSettings: nyi,
  onShowSecretKey: nyi,
})

export default connect(mapStateToProps, mapDispatchToProps)(Header)
