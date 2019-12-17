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
  const menuItems: Kb.MenuItems = [
    {icon: 'iconfont-mention', onClick: props.onSendToKeybaseUser, title: 'To a Keybase user'},
    {icon: 'iconfont-identity-stellar', onClick: props.onSendToStellarAddress, title: 'To a Stellar address'},
    {
      icon: 'iconfont-wallet-transfer',
      onClick: props.onSendToAnotherAccount,
      title: 'To one of your other Stellar accounts',
    },
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
        narrow={Styles.isMobile}
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
    <Kb.WithTooltip tooltip="You can only send from a mobile device more than 7 days old.">
      {button}
    </Kb.WithTooltip>
  ) : (
    button
  )
}
export const SendButton = Kb.OverlayParentHOC(_SendButton)
