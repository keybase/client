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

const CustomComponent = ({onOpenFolder, onChat, onShowMenu, canChat, canViewFolder}: Props) => (
  <Box style={{...globalStyles.flexBoxRow, position: 'absolute', alignItems: 'center', right: 0}}>
    {canChat && (
      <Icon
        onClick={onChat}
        style={{fontSize: isMobile ? 20 : 16, marginRight: globalMargins.tiny}}
        type="iconfont-chat"
      />
    )}
    {!isMobile &&
      canViewFolder && (
        <Icon
          onClick={onOpenFolder}
          style={{fontSize: isMobile ? 20 : 16, marginRight: globalMargins.tiny}}
          type="iconfont-folder-private"
        />
      )}
    <Icon
      onClick={evt => onShowMenu(isMobile ? undefined : evt.target)}
      type="iconfont-ellipsis"
      style={{
        fontSize: isMobile ? 20 : 16,
        marginRight: globalMargins.tiny,
      }}
    />
  </Box>
)
export default CustomComponent
