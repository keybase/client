// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import memoize from 'lodash/memoize'
import {globalStyles, globalMargins} from '../../styles'
import {Box, Text} from '../../common-adapters'
import {ModalLessPopupMenu} from '../../common-adapters/popup-menu.desktop'
import PathItemIcon from './path-item-icon'
import PathItemInfo from './path-item-info'
import filesize from 'filesize'

type Props = {
  name: string,
  size: number,
  type: Types.PathType,
  lastModifiedTimestamp: number,
  lastWriter: string,
  itemStyles: Types.ItemStyles,
  menuItems: Array<{
    title: string,
    onClick: () => void,
  }>,
}

const Popup = ({name, size, type, lastModifiedTimestamp, lastWriter, itemStyles, menuItems}: Props) => {
  console.log(itemStyles)
  const header = {
    title: 'yo',
    view: (
      <Box style={stylesHeader}>
        <PathItemIcon spec={itemStyles.iconSpec} style={pathItemIconStyle} />
        <Text type="BodySmallSemibold" style={filenameStyle(itemStyles.textColor)}>
          {name}
        </Text>
        {type === 'file' ? <Text type="BodySmall">{filesize(size)}</Text> : null}
        <PathItemInfo lastModifiedTimestamp={lastModifiedTimestamp} lastWriter={lastWriter} />
      </Box>
    ),
  }
  const items = menuItems.map(({onClick, title}) => ({
    onClick,
    title,
    view: <Text type="Body">{title}</Text>,
  }))
  return <ModalLessPopupMenu header={header} items={items} style={stylesContainer} />
}

const filenameStyle = memoize(color => ({
  color,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}))

const pathItemIconStyle = {
  marginBottom: globalMargins.xtiny,
}

const stylesContainer = {
  width: 220,
  overflow: 'visible',
  marginTop: 12,
}

const stylesHeader = {
  ...globalStyles.flexBoxColumn,
  width: '100%',
  alignItems: 'center',
  paddingTop: globalMargins.small,
}

export default Popup
