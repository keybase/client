import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {isPhone} from '../../../util/container'
import WalletSwitcher from './wallet-switcher/container'

type Props = {
  children: React.ReactNode
}

const NoSwitcher = (props: Props) => <>{props.children}</>

const Switcher = (props: Props) => {
  const makePopup = React.useCallback((p: Kb.Popup2Parms) => {
    const {attachTo, toggleShowingPopup} = p
    return <WalletSwitcher getAttachmentRef={attachTo} hideMenu={toggleShowingPopup} showingMenu={true} />
  }, [])
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.ClickableBox onClick={toggleShowingPopup} ref={popupAnchor}>
      {props.children}
      {popup}
    </Kb.ClickableBox>
  )
}

const MaybeSwitcher = isPhone ? Switcher : NoSwitcher

export default MaybeSwitcher
