// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile, glamorous} from '../../styles'
import memoize from 'lodash/memoize'
import {Box, ClickableBox, Icon, Text, Divider} from '../../common-adapters'
import PathItemIcon from './path-item-icon'
import PathItemInfo from './path-item-info'

type RowProps = {
  name: string,
  type: Types.PathType,
  lastModifiedTimestamp: number,
  lastWriter: string,
  itemStyles: Types.ItemStyles,
  onOpen: () => void,
  openInFileUI: () => void,
  onAction: (event: SyntheticEvent<>) => void,
}

const HoverBox = glamorous(Box)({
  '& .fs-path-item-hover-icon': {
    color: globalColors.white,
  },
  ':hover .fs-path-item-hover-icon': {
    color: globalColors.black_40,
  },
  '& .fs-path-item-hover-icon:hover': {
    color: globalColors.black_60,
  },
})

export const Row = ({
  name,
  type,
  lastModifiedTimestamp,
  lastWriter,
  itemStyles,
  onOpen,
  openInFileUI,
  onAction,
}: RowProps) => (
  <Box>
    <Box style={stylesCommonRow}>
      <HoverBox style={stylesRowContainer}>
        <ClickableBox onClick={onOpen} style={stylesRowBox}>
          <PathItemIcon spec={itemStyles.iconSpec} style={pathItemIconStyle} />
          <Box style={folderBoxStyle}>
            <Text type={itemStyles.textType} style={rowTextStyles(itemStyles.textColor)}>
              {name}
            </Text>
            {type !== 'folder' ? (
              <PathItemInfo lastModifiedTimestamp={lastModifiedTimestamp} lastWriter={lastWriter} />
            ) : (
              undefined
            )}
          </Box>
        </ClickableBox>
        {!isMobile && (
          <Box style={stylesRowRightBox}>
            <Icon
              type="iconfont-finder"
              style={rowActionIconStyle}
              onClick={openInFileUI}
              className="fs-path-item-hover-icon"
            />
            <Icon
              type="iconfont-ellipsis"
              style={rowActionIconStyle}
              onClick={onAction}
              className="fs-path-item-hover-icon"
            />
          </Box>
        )}
      </HoverBox>
    </Box>
    <Divider style={stylesRowDivider} />
  </Box>
)

export const Placeholder = () => (
  <Box style={stylesCommonRow}>
    <Box style={stylesRowBox}>
      <Icon type={placeholderIcon} style={iconPlaceholderIconStyle} />
      <Box style={folderBoxStyle}>
        <Box style={placeholderTextStyle} />
      </Box>
    </Box>
  </Box>
)

const pathItemIconStyle = {
  marginRight: globalMargins.small,
}

const placeholderIcon = isMobile ? 'iconfont-folder-private' : 'iconfont-folder-private'

const placeholderTextStyle = {
  backgroundColor: globalColors.lightGrey,
  height: 16,
  marginTop: 4,
  width: 256,
}

const folderBoxStyle = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexGrow,
  flex: 1,
  justifyContent: 'space-between',
  minWidth: 0,
}

const rowActionIconStyle = {
  fontSize: 16,
  marginLeft: globalMargins.small,
}

const stylesRowDivider = {
  marginLeft: isMobile ? 48 : 48,
}

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: isMobile ? 64 : 40,
  paddingLeft: globalMargins.small,
}

const stylesRowBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flex: 1,
  minWidth: 0,
}

const stylesRowContainer = {
  ...stylesRowBox,
  justifyContent: 'space-between',
  paddingRight: globalMargins.small,
}

const stylesRowRightBox = {
  ...globalStyles.flexBoxRow,
  flexShrink: 1,
  justifyContent: 'flex-end',
}

const iconPlaceholderIconStyle = {
  fontSize: 32,
  marginRight: globalMargins.small,
}

const rowTextStyles = memoize(color => ({
  color,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}))
