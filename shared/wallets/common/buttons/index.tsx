import * as Kb from '../../../common-adapters'
import * as React from 'react'
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
  const {onSendToKeybaseUser, onSendToStellarAddress, onSendToAnotherAccount} = props
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      const menuItems: Kb.MenuItems = [
        {icon: 'iconfont-mention', onClick: onSendToKeybaseUser, title: 'To a Keybase user'},
        {
          icon: 'iconfont-identity-stellar',
          onClick: onSendToStellarAddress,
          title: 'To a Stellar address',
        },
        {
          icon: 'iconfont-wallet-transfer',
          onClick: onSendToAnotherAccount,
          title: 'To one of your other Stellar accounts',
        },
      ]
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          closeOnSelect={true}
          items={menuItems}
          onHidden={toggleShowingPopup}
          visible={true}
          position="bottom center"
        />
      )
    },
    [onSendToKeybaseUser, onSendToStellarAddress, onSendToAnotherAccount]
  )
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
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
