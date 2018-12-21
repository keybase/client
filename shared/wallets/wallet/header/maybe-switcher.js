// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {isMobile} from '../../../util/container'
import WalletSwitcher from './wallet-switcher/container'

type Props = {|
  children: React.Node,
|}

const NoSwitcher = (props: Props) => props.children

const _Switcher = (props: Props & Kb.OverlayParentProps) => (
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
