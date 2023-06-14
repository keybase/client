import {WalletRow} from '.'
import * as Container from '../../../../../util/container'
import * as ConfigConstants from '../../../../../constants/config'
import {getAccount, getSelectedAccount} from '../../../../../constants/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import type {AccountID} from '../../../../../constants/types/wallets'

type OwnProps = {
  accountID: AccountID
  hideMenu: () => void
}

export default (ownProps: OwnProps) => {
  const account = Container.useSelector(state => getAccount(state, ownProps.accountID))
  const name = account.name
  const me = ConfigConstants.useCurrentUserState(s => s.username)
  const keybaseUser = account.isDefault ? me : ''
  const selectedAccount = Container.useSelector(state => getSelectedAccount(state))
  const contents = account.balanceDescription
  const isSelected = selectedAccount === ownProps.accountID
  const unreadPayments = Container.useSelector(
    state => state.wallets.unreadPaymentsMap.get(ownProps.accountID) ?? 0
  )

  const dispatch = Container.useDispatch()
  const _onSelectAccount = (accountID: AccountID) => {
    dispatch(WalletsGen.createSelectAccount({accountID, reason: 'user-selected', show: true}))
  }
  const props = {
    contents: contents,
    isSelected: isSelected,
    keybaseUser: keybaseUser,
    name: name,
    onSelect: () => {
      // First clear any new payments on the currently selected acct.
      _onSelectAccount(ownProps.accountID)
      ownProps.hideMenu()
    },
    unreadPayments: unreadPayments,
  }
  return <WalletRow {...props} />
}
