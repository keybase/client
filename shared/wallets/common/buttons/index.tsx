import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type SendProps = {
  disabled: boolean
  onSendToKeybaseUser: () => void
  onSendToStellarAddress: () => void
  onSendToAnotherAccount: () => void
  small?: boolean
  thisDeviceIsLockedOut: boolean
}

const _SendButton = (props: Kb.PropsWithOverlay<SendProps>) => {
  const menuItems = [
    {onClick: props.onSendToKeybaseUser, title: 'To a Keybase user'},
    {onClick: props.onSendToStellarAddress, title: 'To a Stellar address'},
    {onClick: props.onSendToAnotherAccount, title: 'To one of your other Stellar accounts'},
  ]
  const button = (
    <>
      <Kb.Button
        small={props.small}
        onClick={props.disabled ? undefined : props.toggleShowingMenu}
        ref={props.setAttachmentRef}
        type="Wallet"
        label="Send"
        disabled={props.disabled}
      />
      <Kb.FloatingMenu
        attachTo={props.getAttachmentRef}
        closeOnSelect={true}
        items={menuItems}
        onHidden={props.toggleShowingMenu}
        visible={props.showingMenu}
        position="bottom center"
      />
    </>
  )
  return props.thisDeviceIsLockedOut ? (
    <Kb.WithTooltip text="You can only send from a mobile device more than 7 days old.">
      {button}
    </Kb.WithTooltip>
  ) : (
    button
  )
}
export const SendButton = Kb.OverlayParentHOC(_SendButton)

type DropdownProps = {
  disabled: boolean
  onShowSecretKey: (() => void) | null
  onSettings: () => void
  small?: boolean
}

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
            onClick={undefined}
            type="Wallet"
            mode="Secondary"
            small={this.props.small}
            style={Styles.collapseStyles([
              styles.dropdownButton,
              this.props.small && styles.dropdownButtonSmall,
            ])}
            disabled={this.props.disabled}
          >
            <Kb.Icon type="iconfont-ellipsis" color={Styles.globalColors.purpleDark} />
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
