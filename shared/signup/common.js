// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'

type InfoIconProps = {
  onDocumentation: () => void,
  onFeedback: () => void,
}

const _InfoIcon = (props: Kb.PropsWithOverlay<InfoIconProps>) => (
  <>
    <Kb.Icon type="iconfont-info" onClick={props.toggleShowingMenu} ref={props.setAttachmentRef} />
    <Kb.FloatingMenu
      items={[
        {onClick: props.onFeedback, title: 'Send feedback'},
        {onClick: props.onDocumentation, title: 'Documentation'},
      ]}
      attachTo={props.getAttachmentRef}
      visible={props.showingMenu}
      onHidden={props.toggleShowingMenu}
      closeOnSelect={true}
    />
  </>
)
export const InfoIcon = Kb.OverlayParentHOC(_InfoIcon)
