// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Types from '../../../../constants/types/wallets'
import WalletRow from '../../../wallet-list/wallet-row/container'

export type Props = {
  accountIDs: Array<Types.AccountID>,
  onAddNew: () => void,
  onLinkExisting: () => void,
  walletName: string,
}

const _WalletSwitcher = (props: Props & Kb.OverlayParentProps) => {
  const menuItems = [
    {
      onClick: () => props.onAddNew(),
      title: 'Create a new account',
    },
    {
      onClick: () => props.onLinkExisting(),
      title: 'Link an existing Stellar account',
    },
  ].concat(
    props.accountIDs.map(accountID => ({
      title: 'test',
      view: <WalletRow accountID={accountID} />,
    }))
  )

  return (
    <Kb.ClickableBox onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
      <Kb.Text type="BodyBig">{props.walletName}</Kb.Text>
      <Kb.FloatingMenu
        attachTo={props.getAttachmentRef}
        closeOnSelect={true}
        items={menuItems}
        onHidden={props.toggleShowingMenu}
        visible={props.showingMenu}
        position="bottom center"
      />
    </Kb.ClickableBox>
  )
}

export const WalletSwitcher = Kb.OverlayParentHOC(_WalletSwitcher)
