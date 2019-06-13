import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {isMobile} from '../../../util/container'
import WalletSwitcher from './wallet-switcher/container'

type Props = React.PropsWithChildren<{}>

// @ts-ignore to fix wrap in fragment
const NoSwitcher: React.FunctionComponent<Props> = props => props.children

const _Switcher: React.FunctionComponent<Props & Kb.OverlayParentProps> = props => (
  <Kb.ClickableBox onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
    {props.children}
    <WalletSwitcher
      getAttachmentRef={props.getAttachmentRef}
      hideMenu={() => props.setShowingMenu(false)}
      showingMenu={props.showingMenu}
    />
  </Kb.ClickableBox>
)

const Switcher = Kb.OverlayParentHOC(_Switcher)

const MaybeSwitcher = isMobile ? Switcher : NoSwitcher

export default MaybeSwitcher
