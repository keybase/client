// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalMargins, isMobile} from '../../styles'
import {Box, Text} from '../../common-adapters'
import {ModalLessPopupMenu} from '../../common-adapters/popup-menu'
import PathItemIcon from './path-item-icon'
import PathItemInfo from './path-item-info'
import filesize from 'filesize'

type Props = {
  name: string,
  size: number,
  type: Types.PathType,
  lastModifiedTimestamp: number,
  lastWriter: string,
  childrenFolders: number,
  childrenFiles: number,
  itemStyles: Types.ItemStyles,
  menuItems: Array<{
    title: string,
    onClick: () => void,
  }>,
  onHidden: () => void,
}

const Popup = ({
  name,
  size,
  type,
  lastModifiedTimestamp,
  lastWriter,
  childrenFolders,
  childrenFiles,
  itemStyles,
  menuItems,
  onHidden,
}: Props) => {
  const header = {
    title: 'yo',
    view: (
      <Box style={stylesHeader}>
        <PathItemIcon spec={itemStyles.iconSpec} style={pathItemIconStyle} />
        <Text type="BodySmallSemibold" style={{color: itemStyles.textColor}} lineClamp={1}>
          {name}
        </Text>
        {type === 'file' ? <Text type="BodySmall">{filesize(size)}</Text> : undefined}
        {type === 'folder' ? (
          <Text type="BodySmall">
            {childrenFolders ? `${childrenFolders} Folders` + (childrenFiles ? ', ' : '') : undefined}
            {childrenFiles ? `${childrenFiles} Files` : undefined}
          </Text>
        ) : (
          undefined
        )}
        <PathItemInfo lastModifiedTimestamp={lastModifiedTimestamp} lastWriter={lastWriter} wrap={true} />
      </Box>
    ),
  }
  const items = menuItems.map(({onClick, title}) => ({
    onClick,
    title,
    view: <Text type="Body">{title}</Text>,
  }))
  return <ModalLessPopupMenu header={header} items={items} style={stylesContainer} onHidden={onHidden} />
}

const pathItemIconStyle = {
  marginBottom: globalMargins.xtiny,
}

const stylesContainer = {
  width: isMobile ? '100%' : 220,
  overflow: 'visible',
  marginTop: isMobile ? undefined : 12,
}

const stylesHeader = {
  ...globalStyles.flexBoxColumn,
  width: '100%',
  alignItems: 'center',
  paddingTop: globalMargins.small,
}

export default Popup
