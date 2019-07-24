import ConfirmSend from '.'
import {namedConnect} from '../../../util/container'
import {getAccount} from '../../../constants/wallets'
import {stringToAccountID} from '../../../constants/types/wallets'

type OwnProps = {}

const mapStateToProps = state => {
  const build = state.wallets.building
  const built = state.wallets.builtPayment

  const recipientType = build.recipientType
  const recipientUsername = (recipientType === 'keybaseUser' && build.to) || ''
  const userInfo = state.users.infoMap.get(recipientUsername)
  let recipientFullName = userInfo ? userInfo.fullname : ''
  const fromAccount = getAccount(state, built.from)

  let recipientStellarAddress
  let recipientAccountIsDefault
  let recipientAccountName
  let recipientAccountAssets
  if (recipientType !== 'keybaseUser') {
    recipientStellarAddress = stringToAccountID(build.to)
    const recipientAccount = getAccount(state, recipientStellarAddress)
    recipientAccountName = recipientAccount.name || recipientAccount.accountID
    recipientAccountIsDefault = recipientAccount.isDefault
    recipientAccountAssets = recipientAccount.balanceDescription
  }

  return {
    fromAccountAssets: built.amountAvailable,
    fromAccountIsDefault: fromAccount.isDefault,
    fromAccountName: fromAccount.name,
    recipientAccountAssets,
    recipientAccountIsDefault,
    recipientAccountName,
    recipientFullName,
    recipientStellarAddress,
    recipientType,
    recipientUsername,
    yourUsername: state.config.username,
  }
}

const mapDispatchToProps = () => ({})

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
    (s, d, o: OwnProps) => ({...o, ...s, ...d}),
  'Participants'
)(ConfirmSend)
