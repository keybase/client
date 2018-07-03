// @flow
import * as React from 'react'
import {Box2, Button, ClickableBox, Text, Avatar, FloatingMenu} from '../../common-adapters'
import {styleSheetCreate} from '../../styles'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../common-adapters/floating-menu'

type Props = {
  isDefaultWallet: boolean,
  onDeposit: () => void,
  onReceive: () => void,
  onSendToAnotherWallet: () => void,
  onSendToKeybaseUser: () => void,
  onSendToStellarAddress: () => void,
  onSettings: () => void,
  onShowSecretKey: () => void,
  keybaseUser?: string,
  walletName: string,
}

const Header = (props: Props) => (
  <Box2
    direction="vertical"
    fullWidth={true}
    gap="tiny"
    gapStart={true}
    gapEnd={true}
    style={styles.noShrink}
  >
    <Box2 direction="horizontal" fullWidth={true} gap="xtiny" style={styles.centerChildren}>
      {props.keybaseUser && <Avatar size={16} username={props.keybaseUser} />}
      <Text type="BodySemibold">{props.walletName}</Text>
    </Box2>
    <Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.centerChildren}>
      {props.isDefaultWallet && <Text type="BodySmall">Default Keybase wallet</Text>}
    </Box2>
    <Box2 direction="horizontal" gap="tiny" style={styles.centerChildren}>
      <SendButton
        onSendToKeybaseUser={props.onSendToKeybaseUser}
        onSendToStellarAddress={props.onSendToStellarAddress}
        onSendToAnotherWallet={props.onSendToAnotherWallet}
      />
      <Button type="Secondary" onClick={props.onReceive} label="Receive" />
      <DropdownButton
        onDeposit={props.onDeposit}
        onSettings={props.onSettings}
        onShowSecretKey={props.onShowSecretKey}
      />
    </Box2>
  </Box2>
)

type SendProps = {
  onSendToKeybaseUser: () => void,
  onSendToStellarAddress: () => void,
  onSendToAnotherWallet: () => void,
}

class _SendButton extends React.PureComponent<SendProps & FloatingMenuParentProps> {
  _menuItems = [
    {
      onClick: () => this.props.onSendToKeybaseUser(),
      title: 'To a Keybase user',
    },
    {
      onClick: () => this.props.onSendToStellarAddress(),
      title: 'To a Stellar address',
    },
    {
      onClick: () => this.props.onSendToAnotherWallet(),
      title: 'To another wallet',
    },
  ]

  render() {
    return (
      <ClickableBox onClick={this.props.toggleShowingMenu} ref={this.props.setAttachmentRef}>
        <Box2 direction="horizontal" fullWidth={true} gap="xsmall">
          <Button onClick={null} type="Wallet" label="Send" />
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

type DropdownProps = {
  onDeposit: () => void,
  onShowSecretKey: () => void,
  onSettings: () => void,
}

class _DropdownButton extends React.PureComponent<DropdownProps & FloatingMenuParentProps> {
  _menuItems = [
    {
      onClick: () => this.props.onDeposit(),
      title: 'Deposit',
    },
    {
      onClick: () => this.props.onShowSecretKey(),
      title: 'Show secret key',
    },
    {
      onClick: () => this.props.onSettings(),
      title: 'Settings',
    },
  ]

  render() {
    return (
      <ClickableBox onClick={this.props.toggleShowingMenu} ref={this.props.setAttachmentRef}>
        <Box2 direction="horizontal" fullWidth={true} gap="xsmall">
          <Button onClick={null} type="Secondary" label="..." />
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

const styles = styleSheetCreate({
  centerChildren: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noShrink: {flexShrink: 0},
})

const SendButton = FloatingMenuParentHOC(_SendButton)

const DropdownButton = FloatingMenuParentHOC(_DropdownButton)

export default Header
