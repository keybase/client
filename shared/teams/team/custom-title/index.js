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

const fontSize = isMobile ? 20 : 16

const _CustomComponent = (props: Props & FloatingMenuParentProps) => (
  <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', position: 'absolute', right: 0}}>
    {props.canChat && <Icon onClick={props.onChat} fontSize={fontSize} style={style} type="iconfont-chat" />}
    {!isMobile &&
      props.canViewFolder && (
        <Icon onClick={props.onOpenFolder} fontSize={fontSize} style={style} type="iconfont-folder-private" />
      )}
    <Icon
      ref={props.setAttachmentRef}
      onClick={props.toggleShowingMenu}
      type="iconfont-ellipsis"
      fontSize={fontSize}
      style={style}
    />
    <TeamMenu
      attachTo={props.attachmentRef}
      onHidden={props.toggleShowingMenu}
      teamname={props.teamname}
      visible={props.showingMenu}
    />
  </Box>
)

const style = {
  marginRight: globalMargins.tiny,
}
const CustomComponent = FloatingMenuParentHOC(_CustomComponent)
export default CustomComponent
