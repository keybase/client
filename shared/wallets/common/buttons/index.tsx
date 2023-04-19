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

export const SendButton = (props: SendProps) => {
  const menuItems: Kb.MenuItems = [
    {icon: 'iconfont-mention', onClick: props.onSendToKeybaseUser, title: 'To a Keybase user'},
    {icon: 'iconfont-identity-stellar', onClick: props.onSendToStellarAddress, title: 'To a Stellar address'},
    {
      icon: 'iconfont-wallet-transfer',
      onClick: props.onSendToAnotherAccount,
      title: 'To one of your other Stellar accounts',
    },
  ]
  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      items={menuItems}
      onHidden={toggleShowingPopup}
      visible={showingPopup}
      position="bottom center"
    />
  ))
  const button = (
    <>
      <Kb.Button
        small={props.small}
        onClick={props.disabled ? undefined : toggleShowingPopup}
        ref={popupAnchor}
        type="Wallet"
        label="Send"
        disabled={props.disabled}
        narrow={Styles.isMobile}
      />
      {popup}
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
