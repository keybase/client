// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {isMobile} from '../../../util/container'
import WalletSwitcher from './wallet-switcher/container'

type Props = {|
  walletName: string,
|}

const PlainName = (props: Props) => <Kb.Text type="BodyBig">{props.walletName}</Kb.Text>

const _NameWithSwitcher = (props: Props & Kb.OverlayParentProps) => (
  <Kb.ClickableBox onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
    <PlainName walletName={props.walletName} />
    <WalletSwitcher
      getAttachmentRef={props.getAttachmentRef}
      showingMenu={props.showingMenu}
      toggleShowingMenu={props.toggleShowingMenu}
    />
  </Kb.ClickableBox>
)

const NameWithSwitcher = Kb.OverlayParentHOC(_NameWithSwitcher)

const Name = isMobile ? NameWithSwitcher : PlainName

export default Name
