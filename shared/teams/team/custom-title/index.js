// @flow
import * as React from 'react'
import {Box, Icon} from '../../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../../styles'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../../common-adapters/floating-menu'
import TeamMenu from '../menu-container'

type Props = {
  onOpenFolder: () => void,
  onChat: () => void,
  canChat: boolean,
  canViewFolder: boolean,
  teamname: string,
}

const _CustomComponent = (props: Props & FloatingMenuParentProps) => (
  <Box style={{...globalStyles.flexBoxRow, position: 'absolute', alignItems: 'center', right: 0}}>
    {props.canChat && (
      <Icon
        onClick={props.onChat}
        style={{fontSize: isMobile ? 20 : 16, marginRight: globalMargins.tiny}}
        type="iconfont-chat"
      />
    )}
    {!isMobile &&
      props.canViewFolder && (
        <Icon
          onClick={props.onOpenFolder}
          style={{fontSize: isMobile ? 20 : 16, marginRight: globalMargins.tiny}}
          type="iconfont-folder-private"
        />
      )}
    <Icon
      ref={props.setAttachmentRef}
      onClick={props.toggleShowingMenu}
      type="iconfont-ellipsis"
      style={{
        fontSize: isMobile ? 20 : 16,
        marginRight: globalMargins.tiny,
      }}
    />
    <TeamMenu
      attachTo={props.attachmentRef}
      onHidden={props.toggleShowingMenu}
      teamname={props.teamname}
      visible={props.showingMenu}
    />
  </Box>
)
const CustomComponent = FloatingMenuParentHOC(_CustomComponent)
export default CustomComponent
