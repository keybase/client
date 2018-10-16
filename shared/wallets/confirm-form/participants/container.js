// @flow
import ConfirmSend from '.'
import {connect} from '../../../util/container'
import {getAccount} from '../../../constants/wallets'
import {stringToAccountID} from '../../../constants/types/wallets'

const mapStateToProps = state => {
  const build = state.wallets.building
  const built = state.wallets.builtPayment

  let recipientUsername = built.toUsername
  const userInfo = state.users.infoMap.get(recipientUsername)
  const recipientFullName = userInfo ? userInfo.fullname : ''
  const fromAccount = getAccount(state, built.from)

  const recipientType = build.recipientType
  let recipientStellarAddress
  let recipientAccountIsDefault
  let recipientAccountName
  let recipientAccountAssets
  if (recipientType === 'keybaseUser') {
    if (build.to.includes('@')) {
      // this is an sbs assertion, which does not get stowed in `built`.
      // `build.to` has the assertion
      recipientUsername = build.to
    }
  } else {
    recipientStellarAddress = stringToAccountID(build.to)
    const recipientAccount = getAccount(state, recipientStellarAddress)
    recipientAccountName = recipientAccount.name || recipientAccount.accountID
    recipientAccountIsDefault = recipientAccount.isDefault
    recipientAccountAssets = recipientAccount.balanceDescription
  }

  return {
    recipientType,
    yourUsername: state.config.username,
    fromAccountAssets: fromAccount.balanceDescription,
    fromAccountIsDefault: fromAccount.isDefault,
    fromAccountName: fromAccount.name,
    recipientStellarAddress,
    recipientAccountName,
    recipientAccountIsDefault,
    recipientAccountAssets,
    recipientFullName,
    recipientUsername,
  }
}

const mapDispatchToProps = dispatch => ({})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(ConfirmSend)
