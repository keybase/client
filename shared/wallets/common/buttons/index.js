// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type SendProps = {|
  disabled: boolean,
  disabledDueToMobileOnly: boolean,
  onSendToKeybaseUser: () => void,
  onSendToStellarAddress: () => void,
  onSendToAnotherAccount: () => void,
  small?: boolean,
|}

class _SendButton extends React.PureComponent<SendProps & Kb.OverlayParentProps> {
  _menuItems = [
    {
      onClick: this.props.onSendToKeybaseUser,
      title: 'To a Keybase user',
    },
    {
      onClick: this.props.onSendToStellarAddress,
      title: 'To a Stellar address',
    },
    {
      onClick: this.props.onSendToAnotherAccount,
      title: 'To one of your other Stellar accounts',
    },
  ]

  render() {
    const button = (
      <>
        <Kb.Button
          small={this.props.small}
          onClick={this.props.disabled ? null : this.props.toggleShowingMenu}
          ref={this.props.setAttachmentRef}
          type="Wallet"
          label="Send"
          disabled={this.props.disabled}
        />
        <Kb.FloatingMenu
          attachTo={this.props.getAttachmentRef}
          closeOnSelect={true}
          items={this._menuItems}
          onHidden={this.props.toggleShowingMenu}
          visible={this.props.showingMenu}
          position="bottom center"
        />
      </>
    )
    return this.props.disabledDueToMobileOnly ? (
      <Kb.WithTooltip text="This is a mobile-only account.">{button}</Kb.WithTooltip>
    ) : (
      button
    )
  }
}
export const SendButton = Kb.OverlayParentHOC(_SendButton)

type DropdownProps = {|
  disabled: boolean,
  onShowSecretKey: ?() => void,
  onSettings: () => void,
  small?: boolean,
|}

class _DropdownButton extends React.PureComponent<DropdownProps & Kb.OverlayParentProps> {
  render() {
    const onShowSecretKey = this.props.onShowSecretKey
    const _menuItems = [
      onShowSecretKey
        ? {
            onClick: onShowSecretKey,
            title: 'Show secret key',
          }
        : null,
      {
        onClick: this.props.onSettings,
        title: 'Settings',
      },
    ].filter(Boolean)

    return (
      <Kb.ClickableBox
        onClick={!this.props.disabled ? this.props.toggleShowingMenu : undefined}
        ref={this.props.setAttachmentRef}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="xsmall">
          <Kb.Button
            onClick={null}
            type="Wallet"
            mode="Secondary"
            small={this.props.small}
            style={Styles.collapseStyles([
              styles.dropdownButton,
              this.props.small && styles.dropdownButtonSmall,
            ])}
            disabled={this.props.disabled}
          >
            <Kb.Icon type="iconfont-ellipsis" color={Styles.globalColors.purple} />
          </Kb.Button>
        </Kb.Box2>
        <Kb.FloatingMenu
          attachTo={this.props.getAttachmentRef}
          closeOnSelect={true}
          items={_menuItems}
          onHidden={this.props.toggleShowingMenu}
          visible={this.props.showingMenu}
          position="bottom center"
          positionFallbacks={[]}
        />
      </Kb.ClickableBox>
    )
  }
}
export const DropdownButton = Kb.OverlayParentHOC(_DropdownButton)

const styles = Styles.styleSheetCreate({
  dropdownButton: Styles.platformStyles({
    common: {
      minWidth: undefined,
    },
    isElectron: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.xsmall,
      paddingRight: Styles.globalMargins.xsmall,
    },
  }),
  dropdownButtonSmall: {
    paddingLeft: 10,
    paddingRight: 10,
  },
})
