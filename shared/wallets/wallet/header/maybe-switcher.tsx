import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {isPhone} from '../../../util/container'
import WalletSwitcher from './wallet-switcher/container'

type Props = {
  children: React.ReactNode
}

const NoSwitcher = (props: Props) => <>{props.children}</>

const Switcher = (props: Props) => {
  const {toggleShowingPopup, setShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <WalletSwitcher
      getAttachmentRef={attachTo}
      hideMenu={() => setShowingPopup(false)}
      showingMenu={showingPopup}
    />
  ))

  return (
    <Kb.ClickableBox onClick={toggleShowingPopup} ref={popupAnchor}>
      {props.children}
      {popup}
    </Kb.ClickableBox>
  )
}

const MaybeSwitcher = isPhone ? Switcher : NoSwitcher

export default MaybeSwitcher
