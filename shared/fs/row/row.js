// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile, glamorous, platformStyles} from '../../styles'
import memoize from 'lodash/memoize'
import {Box, ClickableBox, Icon, Text, Divider} from '../../common-adapters'
import PathItemIcon from '../common/path-item-icon'
import PathItemInfo from '../common/path-item-info'

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

const HoverBox = isMobile
  ? Box
  : glamorous(Box)({
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

export const Row = (props: RowProps) => (
  <Box>
    <Box style={stylesCommonRow}>
      <HoverBox style={stylesRowContainer}>
        <ClickableBox onClick={props.onOpen} style={stylesRowBox}>
          <PathItemIcon spec={props.itemStyles.iconSpec} style={pathItemIconStyle} />
          <Box style={folderBoxStyle}>
            <Text
              type={props.itemStyles.textType}
              style={rowTextStyles(props.itemStyles.textColor)}
              lineClamp={isMobile ? 1 : undefined}
            >
              {props.name}
            </Text>
            {props.type !== 'folder' && (
              <PathItemInfo
                lastModifiedTimestamp={props.lastModifiedTimestamp}
                lastWriter={props.lastWriter}
              />
            )}
          </Box>
        </ClickableBox>
        <Box style={stylesRowRightBox}>
          {!isMobile && (
            <Icon
              type="iconfont-finder"
              style={rowActionIconStyle}
              onClick={props.openInFileUI}
              className="fs-path-item-hover-icon"
            />
          )}
          <Icon
            type="iconfont-ellipsis"
            style={rowActionIconStyle}
            onClick={props.onAction}
            className="fs-path-item-hover-icon"
          />
        </Box>
      </HoverBox>
    </Box>
    <Divider style={stylesRowDivider} />
  </Box>
)

export const Placeholder = () => (
  <Box style={stylesCommonRow}>
    <Box style={stylesRowBox}>
      <Icon type={placeholderIcon} style={stylePlaceholderIcon} />
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

const stylePlaceholderIcon = {
  fontSize: 32,
  marginRight: globalMargins.small,
}

const rowTextStyles = memoize(color =>
  platformStyles({
    common: {
      color,
    },
    isElectron: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  })
)
