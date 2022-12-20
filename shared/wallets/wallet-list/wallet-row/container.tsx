import * as Container from '../../../util/container'
import * as React from 'react'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import type {AccountID} from '../../../constants/types/wallets'
import {WalletRow} from '.'
import {getAccount, getSelectedAccount} from '../../../constants/wallets'

// TODO: This is now desktop-only, so remove references to isMobile.

type OwnProps = {
  accountID: AccountID
}

const WalletRowContainer = (op: OwnProps) => {
  const {accountID} = op
  const account = Container.useSelector(state => getAccount(state, accountID))
  const name = account.name
  const me = Container.useSelector(state => state.config.username)
  const keybaseUser = account.isDefault ? me : ''
  const selectedAccount = Container.useSelector(state => getSelectedAccount(state))
  const contents = account.balanceDescription
  const isSelected = !Container.isPhone && selectedAccount === accountID
  const unreadPayments = Container.useSelector(state => state.wallets.unreadPaymentsMap.get(accountID) ?? 0)

  const dispatch = Container.useDispatch()
  const onSelectAccount = React.useCallback(() => {
    if (!Container.isPhone) {
      dispatch(RouteTreeGen.createNavUpToScreen({name: 'wallet'}))
    }
    dispatch(WalletsGen.createSelectAccount({accountID, reason: 'user-selected', show: true}))
  }, [dispatch, accountID])

  return (
    <WalletRow
      contents={contents}
      isSelected={isSelected}
      keybaseUser={keybaseUser}
      name={name}
      // First clear any new payments on the currently selected acct.
      onSelect={onSelectAccount}
      unreadPayments={unreadPayments}
    />
  )
}
export default WalletRowContainer
