// @flow
import * as React from 'react'
import {Box, Icon} from '../../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../../styles'

type Props = {
  onOpenFolder: () => void,
  onChat: () => void,
  onShowMenu: any => void,
  canChat: boolean,
  canViewFolder: boolean,
}

const fontSize = isMobile ? 20 : 16

const CustomComponent = ({onOpenFolder, onChat, onShowMenu, canChat, canViewFolder}: Props) => (
  <Box style={{...globalStyles.flexBoxRow, position: 'absolute', alignItems: 'center', right: 0}}>
    {canChat && <Icon onClick={onChat} fontSize={fontSize} style={style} type="iconfont-chat" />}
    {!isMobile &&
      canViewFolder && (
        <Icon onClick={onOpenFolder} fontSize={fontSize} style={style} type="iconfont-folder-private" />
      )}
    <Icon
      onClick={evt => onShowMenu(isMobile ? undefined : evt.target)}
      type="iconfont-ellipsis"
      fontSize={fontSize}
      style={style}
    />
  </Box>
)

const style = {
  marginRight: globalMargins.tiny,
}
export default CustomComponent
