// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {isMobile} from '../../../util/container'
import WalletSwitcher from './wallet-switcher/container'

type Props = {|
  children: React.Node,
|}

const JustChildren = (props: Props) => props.children

const _NameWithSwitcher = (props: Props & Kb.OverlayParentProps) => (
  <Kb.ClickableBox onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
    {props.children}
    <WalletSwitcher
      getAttachmentRef={props.getAttachmentRef}
      hideMenu={() => props.setShowingMenu(false)}
      showingMenu={props.showingMenu}
    />
  </Kb.ClickableBox>
)

const NameWithSwitcher = Kb.OverlayParentHOC(_NameWithSwitcher)

const Name = isMobile ? NameWithSwitcher : JustChildren

export default Name
