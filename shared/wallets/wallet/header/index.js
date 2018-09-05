// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  isDefaultWallet: boolean,
  onDeposit: () => void,
  onReceive: () => void,
  onSendToAnotherAccount: () => void,
  onSendToKeybaseUser: () => void,
  onSendToStellarAddress: () => void,
  onSettings: () => void,
  onShowSecretKey: () => void,
  keybaseUser?: string,
  walletName: string,
}

const Header = (props: Props) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    gap="tiny"
    gapStart={true}
    gapEnd={true}
    style={styles.noShrink}
  >
    <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny" centerChildren={true}>
        {props.keybaseUser && <Kb.Avatar size={16} username={props.keybaseUser} />}
        <Kb.Text selectable={true} type="BodyBig">
          {props.walletName}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true}>
        {props.isDefaultWallet && <Kb.Text type="BodySmall">Default Keybase wallet</Kb.Text>}
      </Kb.Box2>
    </Kb.Box2>
    <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true}>
      <SendButton
        onSendToKeybaseUser={props.onSendToKeybaseUser}
        onSendToStellarAddress={props.onSendToStellarAddress}
        onSendToAnotherAccount={props.onSendToAnotherAccount}
      />
      <Kb.Button type="Secondary" onClick={props.onReceive} label="Receive" />
      <DropdownButton
        onDeposit={props.onDeposit}
        onSettings={props.onSettings}
        onShowSecretKey={props.onShowSecretKey}
      />
    </Kb.Box2>
  </Kb.Box2>
)

type SendProps = {
  onSendToKeybaseUser: () => void,
  onSendToStellarAddress: () => void,
  onSendToAnotherAccount: () => void,
}

class _SendButton extends React.PureComponent<SendProps & Kb.OverlayParentProps> {
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
      onClick: () => this.props.onSendToAnotherAccount(),
      title: 'To another account',
    },
  ]

  render() {
    return (
      <Kb.ClickableBox onClick={this.props.toggleShowingMenu} ref={this.props.setAttachmentRef}>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="xsmall">
          <Kb.Button onClick={null} type="Wallet" label="Send" />
        </Kb.Box2>
        <Kb.FloatingMenu
          attachTo={this.props.attachmentRef}
          closeOnSelect={true}
          items={this._menuItems}
          onHidden={this.props.toggleShowingMenu}
          visible={this.props.showingMenu}
          position="bottom center"
        />
      </Kb.ClickableBox>
    )
  }
}

type DropdownProps = {
  onDeposit: () => void,
  onShowSecretKey: () => void,
  onSettings: () => void,
}

class _DropdownButton extends React.PureComponent<DropdownProps & Kb.OverlayParentProps> {
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
      <Kb.ClickableBox onClick={this.props.toggleShowingMenu} ref={this.props.setAttachmentRef}>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="xsmall">
          <Kb.Button onClick={null} type="Secondary" style={styles.dropdownButton}>
            <Kb.Icon
              fontSize={Styles.isMobile ? 22 : 16}
              type="iconfont-ellipsis"
              color={Styles.globalColors.black_75}
            />
          </Kb.Button>
        </Kb.Box2>
        <Kb.FloatingMenu
          attachTo={this.props.attachmentRef}
          closeOnSelect={true}
          items={this._menuItems}
          onHidden={this.props.toggleShowingMenu}
          visible={this.props.showingMenu}
          position="bottom center"
        />
      </Kb.ClickableBox>
    )
  }
}

const styles = Styles.styleSheetCreate({
  noShrink: {flexShrink: 0},
  dropdownButton: Styles.platformStyles({
    isElectron: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.xsmall,
      paddingRight: Styles.globalMargins.xsmall,
    },
  }),
})

const SendButton = Kb.OverlayParentHOC(_SendButton)

const DropdownButton = Kb.OverlayParentHOC(_DropdownButton)

export default Header
