import ConfirmSend from '.'
import * as Container from '../../../util/container'
import {getAccount} from '../../../constants/wallets'
import * as ConfigConstants from '../../../constants/config'
import {stringToAccountID} from '../../../constants/types/wallets'

export default () => {
  const build = Container.useSelector(state => state.wallets.building)
  const built = Container.useSelector(state => state.wallets.builtPayment)

  const recipientType = build.recipientType
  const recipientUsername = (recipientType === 'keybaseUser' && build.to) || ''
  const userInfo = Container.useSelector(state => state.users.infoMap.get(recipientUsername))
  const recipientFullName = userInfo?.fullname || ''
  const fromAccount = Container.useSelector(state => getAccount(state, built.from))

  const {recipientStellarAddress, recipientAccountIsDefault, recipientAccountName, recipientAccountAssets} =
    Container.useSelector(state => {
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
        recipientAccountAssets,
        recipientAccountIsDefault,
        recipientAccountName,
        recipientStellarAddress,
      }
    })

  const fromAccountAssets = built.amountAvailable
  const fromAccountIsDefault = fromAccount.isDefault
  const fromAccountName = fromAccount.name
  const yourUsername = ConfigConstants.useCurrentUserState(s => s.username)

  const props = {
    fromAccountAssets,
    fromAccountIsDefault,
    fromAccountName,
    recipientAccountAssets,
    recipientAccountIsDefault,
    recipientAccountName,
    recipientFullName,
    recipientStellarAddress,
    recipientType,
    recipientUsername,
    yourUsername,
  }
  return <ConfirmSend {...props} />
}
