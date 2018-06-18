// @flow
import * as React from 'react'
import {Box2, ClickableBox, Icon, Text, FloatingMenu} from '../../common-adapters'
import {globalMargins, globalColors, isMobile} from '../../styles'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../common-adapters/floating-menu'
import {type AccountID} from '../../constants/types/wallets'
import WalletRow from './wallet-row/container'

type AddProps = {
  onAddNew: () => void,
  onLinkExisting: () => void,
}

const _AddWallet = (props: AddProps & FloatingMenuParentProps) => {
  const rowHeight = isMobile ? 56 : 48

  const menuItems = [
    {
      onClick: () => props.onAddNew(),
      title: 'Create a new wallet',
    },
    {
      disabled: isMobile,
      onClick: () => props.onLinkExisting(),
      title: 'Link an existing Stellar wallet',
    },
  ]

  return (
    <ClickableBox
      onClick={props.toggleShowingMenu}
      style={{backgroundColor: globalColors.white}}
      ref={props.setAttachmentRef}
    >
      <Box2
        style={{height: rowHeight, paddingTop: globalMargins.small}}
        direction="horizontal"
        fullWidth={true}
        gap="xsmall"
        gapStart={true}
        gapEnd={true}
      >
        <Icon type="iconfont-new" color={globalColors.blue} />
        <Text type="BodyBigLink">Add a wallet</Text>
      </Box2>
      <FloatingMenu
        attachTo={props.attachmentRef}
        closeOnSelect={true}
        items={menuItems}
        onHidden={props.toggleShowingMenu}
        visible={props.showingMenu}
        position="bottom center"
      />
    </ClickableBox>
  )
}

const AddWallet = FloatingMenuParentHOC(_AddWallet)

type Props = {
  accountIDs: Array<AccountID>,
  onAddNew: () => void,
  onLinkExisting: () => void,
}

const WalletList = (props: Props) => (
  <Box2 direction="vertical" style={{height: '100%', width: 240}}>
    {props.accountIDs.map(accountID => <WalletRow key={accountID} accountID={accountID} />)}
    <AddWallet onAddNew={props.onAddNew} onLinkExisting={props.onLinkExisting} />
  </Box2>
)

export type {Props}
export {WalletList}
