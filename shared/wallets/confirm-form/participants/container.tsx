import ConfirmSend from '.'
import * as Container from '../../../util/container'
import {getAccount} from '../../../constants/wallets'
import {stringToAccountID} from '../../../constants/types/wallets'

type OwnProps = {}

export default Container.connect(
  state => {
    const build = state.wallets.building
    const built = state.wallets.builtPayment

    const recipientType = build.recipientType
    const recipientUsername = (recipientType === 'keybaseUser' && build.to) || ''
    const userInfo = state.users.infoMap.get(recipientUsername)
    const recipientFullName = userInfo?.fullname || ''
    const fromAccount = getAccount(state, built.from)

    let recipientStellarAddress: string | undefined
    let recipientAccountIsDefault: boolean | undefined
    let recipientAccountName: string | undefined
    let recipientAccountAssets: string | undefined
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
  },
  () => ({}),
  (s, d, o: OwnProps) => ({
    ...o,
    ...s,
    ...d,
  })
)(ConfirmSend)
