// @flow
import ConfirmSend from '.'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import {getAccount} from '../../../constants/wallets'
import {stringToAccountID} from '../../../constants/types/wallets'

const mapStateToProps = (state: TypedState) => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment

  const recipientType = build.recipientType || 'keybaseUser'
  const fromAccount = getAccount(state, stringToAccountID(build.from))
  const recipientAccount = getAccount(state, stringToAccountID(build.to))
  const recipientStellarAddress = build.to

  return {
    recipientType,
    yourUsername: state.config.username,
    fromAccountAssets: fromAccount.balanceDescription,
    fromAccountName: fromAccount.name || fromAccount.accountID,
    recipientAccountAssets: recipientAccount.balanceDescription,
    recipientAccountName: recipientAccount.name || recipientAccount.accountID,
    recipientUsername: built.toUsername,
    recipientStellarAddress,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => {}

export default connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}))(ConfirmSend)
