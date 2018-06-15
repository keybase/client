// @flow
import * as React from 'react'
import {Box2, ClickableBox, Icon, Text, Avatar, FloatingMenu} from '../../common-adapters'
import {globalStyles, globalColors, isMobile} from '../../styles'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../common-adapters/floating-menu'

type WalletProps = {
  isSelected: boolean,
  name: string,
  keybaseUser: string,
  contents: string,
  onSelect: () => void,
}

class Wallet extends React.PureComponent<WalletProps> {
  render() {
    const color = this.props.isSelected ? globalColors.blue : globalColors.white

    const titleStyle = {
      ...globalStyles.fontSemibold,
      color: this.props.isSelected ? globalColors.white : globalColors.darkBlue,
      backgroundColor: color,
      fontSize: 13,
    }
    const amountStyle = {
      color: this.props.isSelected ? globalColors.white : globalColors.black_40,
      backgroundColor: color,
      fontSize: 11,
    }
    const props = this.props
    return (
      <ClickableBox onClick={props.onSelect} style={{backgroundColor: color}}>
        <Box2 style={{height: rowHeight, backgroundColor: color}} direction="horizontal" fullWidth={true}>
          <Box2 direction="horizontal" gap="small">
            <Icon type="icon-wallet-64" color={globalColors.darkBlue} style={{height: 32}} />
          </Box2>
          <Box2 direction="vertical">
            <Box2 direction="horizontal" fullWidth={true} gap="xtiny">
              {this.props.keybaseUser && <Avatar size={16} username={this.props.keybaseUser} />}
              <Text type="BodySmall" style={titleStyle}>
                {props.name}
              </Text>
            </Box2>
            <Text type="BodySmall" style={amountStyle}>
              {props.contents}
            </Text>
          </Box2>
        </Box2>
      </ClickableBox>
    )
  }
}

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
        <Box2 style={{height: rowHeight}} direction="horizontal" fullWidth={true} gap="xsmall">
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
    isSelected: boolean,
    name: string,
    keybaseUser: string,
    contents: string,
  }>,
  onSelect: (name: string) => void,
  onAddNew: () => void,
  onLinkExisting: () => void,
}

const WalletList = (props: Props) => (
  <Box2 direction="vertical" style={{width: 240}}>
    {props.wallets.map(w => (
      <Wallet
        key={w.name}
        onSelect={() => props.onSelect(w.name)}
        isSelected={w.isSelected}
        name={w.name}
        keybaseUser={w.keybaseUser}
        contents={w.contents}
      />
    ))}
    <AddWallet onAddNew={props.onAddNew} onLinkExisting={props.onLinkExisting} />
  </Box2>
)

export {WalletList}
