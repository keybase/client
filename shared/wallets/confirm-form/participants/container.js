// @flow
import ConfirmSend from '.'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import {getAccount} from '../../../constants/wallets'
import {stringToAccountID} from '../../../constants/types/wallets'

const mapStateToProps = (state: TypedState) => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment

  const recipientType = build.recipientType || 'keybaseUser'
  let recipientUsername = built.toUsername
  const userInfo = state.users.infoMap.get(recipientUsername)
  const recipientFullName = userInfo ? userInfo.fullname : ''
  const fromAccount = getAccount(state, stringToAccountID(built.from))
  const recipientAccount = getAccount(state, stringToAccountID(build.to))
  const recipientAccountIsDefault = recipientAccount.isDefault
  const recipientStellarAddress = build.to

  if (recipientType === 'keybaseUser' && build.to.includes('@')) {
    // this is an sbs assertion, which does not get stowed in `built`.
    // `build.to` has the assertion
    recipientUsername = build.to
  }

  return {
    recipientType,
    yourUsername: state.config.username,
    fromAccountAssets: fromAccount.balanceDescription,
    fromAccountIsDefault: fromAccount.isDefault,
    fromAccountName: fromAccount.name || fromAccount.accountID,
    recipientAccountAssets: recipientAccount.balanceDescription,
    recipientAccountName: recipientAccount.name || recipientAccount.accountID,
    recipientAccountIsDefault,
    recipientFullName,
    recipientStellarAddress,
    recipientUsername,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(ConfirmSend)
