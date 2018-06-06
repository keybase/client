// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {globalStyles, globalMargins, isMobile, platformStyles} from '../../styles'
import {Box, Text} from '../../common-adapters'
import {ModalLessPopupMenu} from '../../common-adapters/popup-menu'
import PathItemIcon from '../common/path-item-icon'
import PathItemInfo from '../common/path-item-info'
import {memoize} from 'lodash'

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
    subTitle?: string,
    danger?: boolean,
  }>,
  onHidden: () => void,
}

const Popup = (props: Props) => {
  const header = {
    title: 'unused',
    view: (
      <Box style={stylesHeader}>
        <PathItemIcon spec={props.itemStyles.iconSpec} style={pathItemIconStyle} />
        <Box style={stylesNameTextBox}>
          <Text type="BodySmallSemibold" style={stylesNameText(props.itemStyles.textColor)}>
            {props.name}
          </Text>
        </Box>
        {props.type === 'file' && <Text type="BodySmall">{Constants.humanReadableFileSize(props.size)}</Text>}
        {props.type === 'folder' && (
          <Text type="BodySmall">
            {props.childrenFolders
              ? `${props.childrenFolders} Folder${props.childrenFolders > 1 ? 's' : ''}${
                  props.childrenFiles ? ', ' : ''
                }`
              : undefined}
            {props.childrenFiles
              ? `${props.childrenFiles} File${props.childrenFiles > 1 ? 's' : ''}`
              : undefined}
          </Text>
        )}
        <PathItemInfo
          lastModifiedTimestamp={props.lastModifiedTimestamp}
          lastWriter={props.lastWriter}
          wrap={true}
        />
      </Box>
    ),
  }
  const items = props.menuItems.map(({onClick, title, subTitle, danger}) => ({
    onClick,
    title,
    subTitle,
    danger,
  }))
  return (
    <ModalLessPopupMenu header={header} items={items} style={stylesContainer} onHidden={props.onHidden} />
  )
}

const stylesNameText = memoize(color =>
  platformStyles({
    common: {
      color,
      textAlign: 'center',
    },
    isElectron: {
      overflowWrap: 'break-word',
    },
  })
)

const stylesNameTextBox = {
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  width: '100%',
  textAlign: 'center',
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
