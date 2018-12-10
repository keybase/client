// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import MenuLayout from '../../../../common-adapters/floating-menu/menu-layout'
import * as Types from '../../../../constants/types/wallets'
import WalletRow from '../../../wallet-list/wallet-row/container'

export type Props = {
  accountIDs: Array<Types.AccountID>,
  onAddNew: () => void,
  onLinkExisting: () => void,
  walletName: string,
}

const Menu = (props: Props & Kb.OverlayParentProps) => {
  if (!props.showingMenu) {
    return null
  }

  const menuItems = [
    {
      onClick: props.onAddNew,
      title: 'Create a new account',
    },
    {
      onClick: props.onLinkExisting,
      title: 'Link an existing Stellar account',
    },
  ].concat(
    props.accountIDs.map(accountID => ({
      title: accountID,
      view: <WalletRow accountID={accountID} onSelect={props.toggleShowingMenu} />,
    }))
  )

  return (
    <Kb.Overlay
      position="bottom center"
      onHidden={props.toggleShowingMenu}
      visible={props.showingMenu}
      attachTo={props.getAttachmentRef}
    >
      <MenuLayout onHidden={props.toggleShowingMenu} items={menuItems} closeOnClick={true} />
    </Kb.Overlay>
  )
}

const _WalletSwitcher = (props: Props & Kb.OverlayParentProps) => (
  <Kb.ClickableBox onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
    <Kb.Text type="BodyBig">{props.walletName}</Kb.Text>
    <Menu {...props} />
  </Kb.ClickableBox>
)

export const WalletSwitcher = Kb.OverlayParentHOC(_WalletSwitcher)
