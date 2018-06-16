// @flow
import * as React from 'react'
import {Box2, ClickableBox, Icon, Text, FloatingMenu} from '../../common-adapters'
import {globalMargins, globalColors, isMobile} from '../../styles'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../common-adapters/floating-menu'
import {type AccountID} from '../../constants/types/wallets'
import {WalletRow} from './wallet-row'

type AddProps = {
  onAddNew: () => void,
  onLinkExisting: () => void,
}

class _AddWallet extends React.PureComponent<AddProps & FloatingMenuParentProps> {
  _menuItems = [
    {
      onClick: () => this.props.onAddNew(),
      title: 'Create a new wallet',
    },
    {
      disabled: isMobile,
      onClick: () => this.props.onLinkExisting(),
      title: 'Link an existing Stellar wallet',
    },
  ]

  render() {
    return (
      <ClickableBox
        onClick={this.props.toggleShowingMenu}
        style={{backgroundColor: globalColors.white}}
        ref={this.props.setAttachmentRef}
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
          attachTo={this.props.attachmentRef}
          closeOnSelect={true}
          items={this._menuItems}
          onHidden={this.props.toggleShowingMenu}
          visible={this.props.showingMenu}
          position="bottom center"
        />
      </ClickableBox>
    )
  }
}

const AddWallet = FloatingMenuParentHOC(_AddWallet)

const rowHeight = isMobile ? 56 : 48

type Props = {
  wallets: Array<{
    accountID: AccountID,
    name: string,
    keybaseUser: string,
    contents: string,
  }>,
  selectedAccount: ?AccountID,
  onSelectAccount: (accountID: AccountID) => void,
  onAddNew: () => void,
  onLinkExisting: () => void,
}

const WalletList = (props: Props) => (
  <Box2 direction="vertical" style={{height: '100%', width: 240}}>
    {props.wallets.map(w => (
      <WalletRow
        key={w.accountID}
        onSelect={() => props.onSelectAccount(w.accountID)}
        isSelected={w.accountID === props.selectedAccount}
        name={w.name}
        keybaseUser={w.keybaseUser}
        contents={w.contents}
      />
    ))}
    <AddWallet onAddNew={props.onAddNew} onLinkExisting={props.onLinkExisting} />
  </Box2>
)

export type {Props}
export {WalletList}
