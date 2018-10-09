// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/wallets'
import * as Styles from '../../../styles'
import {SmallAccountID} from '../../common'

type Props = {
  accountID: Types.AccountID,
  isDefaultWallet: boolean,
  onReceive: () => void,
  onBack: ?() => void,
  onRequest: () => void,
  onSendToAnotherAccount: () => void,
  onSendToKeybaseUser: () => void,
  onSendToStellarAddress: () => void,
  onSettings: () => void,
  onShowSecretKey: () => void,
  keybaseUser: string,
  walletName: ?string,
}

const Header = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" gapStart={true} style={styles.noShrink}>
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        gap="xtiny"
        centerChildren={true}
        style={styles.topContainer}
      >
        {props.onBack && <Kb.BackButton onClick={props.onBack} style={styles.backButton} />}
        {props.isDefaultWallet && <Kb.Avatar size={16} username={props.keybaseUser} />}
        {props.walletName ? (
          <Kb.Text selectable={true} type="BodyBig">
            {props.walletName}
          </Kb.Text>
        ) : (
          <Kb.ProgressIndicator style={styles.spinner} type="Small" />
        )}
      </Kb.Box2>
      {props.isDefaultWallet && (
        <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true}>
          <Kb.Text type="BodySmall">Default Keybase account</Kb.Text>
        </Kb.Box2>
      )}
      {!!props.walletName && (
        <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true}>
          <SmallAccountID accountID={props.accountID} />
        </Kb.Box2>
      )}
    </Kb.Box2>
    <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true}>
      <SendButton
        onSendToKeybaseUser={props.onSendToKeybaseUser}
        onSendToStellarAddress={props.onSendToStellarAddress}
        onSendToAnotherAccount={props.onSendToAnotherAccount}
        disabled={!props.walletName}
      />
      <Kb.Button type="Wallet" onClick={props.onRequest} label="Request" disabled={!props.walletName} />
      <Kb.Button type="Secondary" onClick={props.onReceive} label="Receive" disabled={!props.walletName} />
      <DropdownButton
        onSettings={props.onSettings}
        onShowSecretKey={props.onShowSecretKey}
        disabled={!props.walletName}
      />
    </Kb.Box2>
    <Kb.Divider />
  </Kb.Box2>
)

type SendProps = {|
  onSendToKeybaseUser: () => void,
  onSendToStellarAddress: () => void,
  onSendToAnotherAccount: () => void,
  disabled: boolean,
|}

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
      <Kb.ClickableBox
        onClick={!this.props.disabled ? this.props.toggleShowingMenu : undefined}
        ref={this.props.setAttachmentRef}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="xsmall">
          <Kb.Button onClick={null} type="Wallet" label="Send" disabled={this.props.disabled} />
        </Kb.Box2>
        <Kb.FloatingMenu
          attachTo={this.props.getAttachmentRef}
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

type DropdownProps = {|
  onShowSecretKey: () => void,
  onSettings: () => void,
  disabled: boolean,
|}

class _DropdownButton extends React.PureComponent<DropdownProps & Kb.OverlayParentProps> {
  _menuItems = [
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
      <Kb.ClickableBox
        onClick={!this.props.disabled ? this.props.toggleShowingMenu : undefined}
        ref={this.props.setAttachmentRef}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="xsmall">
          <Kb.Button
            onClick={null}
            type="Secondary"
            style={styles.dropdownButton}
            disabled={this.props.disabled}
          >
            <Kb.Icon
              fontSize={Styles.isMobile ? 22 : 16}
              type="iconfont-ellipsis"
              color={Styles.globalColors.black_75}
            />
          </Kb.Button>
        </Kb.Box2>
        <Kb.FloatingMenu
          attachTo={this.props.getAttachmentRef}
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
  backButton: {
    left: 0,
    position: 'absolute',
  },
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
  noShrink: {flexShrink: 0},
  spinner: {
    height: Styles.globalMargins.small,
    width: Styles.globalMargins.small,
  },
  topContainer: {
    position: 'relative',
  },
})

const SendButton = Kb.OverlayParentHOC(_SendButton)

const DropdownButton = Kb.OverlayParentHOC(_DropdownButton)

export default Header
