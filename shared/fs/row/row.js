// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile, glamorous, platformStyles} from '../../styles'
import {Badge, Box, ClickableBox, Icon, Meta, Text, Divider} from '../../common-adapters'
import {memoize} from 'lodash-es'
import PathItemIcon from '../common/path-item-icon'
import PathItemInfo from '../common/path-item-info'

type RowProps = {
  name: string,
  type: Types.PathType,
  lastModifiedTimestamp: number,
  lastWriter: string,
  shouldShowMenu: boolean,
  itemStyles: Types.ItemStyles,
  badgeCount: number,
  tlfMeta?: Types.FavoriteMetadata,
  resetParticipants: Array<string>,
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

const RowMeta = ({badgeCount, isNew, isIgnored, needsRekey, resetParticipants}) => {
  if (isIgnored || !(isNew || isIgnored || needsRekey || badgeCount || resetParticipants)) {
    return <Box />
  }

  return (
    <Box style={{width: 0, display: 'flex'}}>
      {needsRekey && (
        <Box style={styleBadgeContainerRekey}>
          <Meta title="rekey" backgroundColor={globalColors.red} />
        </Box>
      )}
      {resetParticipants.length > 0 && (
        <Box style={styleBadgeContainerRekey}>
          <Meta title="reset" backgroundColor={globalColors.red} />
        </Box>
      )}
      {isNew && (
        <Box style={styleBadgeContainerNew}>
          <Meta title="new" backgroundColor={globalColors.orange} />
        </Box>
      )}
      <Box style={styleBadgeContainer}>
        {!!badgeCount && <Badge badgeNumber={badgeCount} badgeStyle={badgeStyleCount} />}
      </Box>
    </Box>
  )
}

export const Row = (props: RowProps) => (
  <Box>
    <Box style={stylesCommonRow}>
      <HoverBox style={stylesRowContainer}>
        <ClickableBox onClick={props.onOpen} style={stylesRowBox}>
          <PathItemIcon spec={props.itemStyles.iconSpec} style={pathItemIconStyle} />
          <RowMeta badgeCount={props.badgeCount} {...props.tlfMeta} resetParticipants={props.resetParticipants} />
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
              fontSize={rowActionIconFontSize}
              onClick={props.openInFileUI}
              className="fs-path-item-hover-icon"
            />
          )}
          {props.shouldShowMenu && (
            <Icon
              type="iconfont-ellipsis"
              style={rowActionIconStyle}
              onClick={props.onAction}
              className="fs-path-item-hover-icon"
            />
          )}
        </Box>
      </HoverBox>
    </Box>
    <Divider style={stylesRowDivider} />
  </Box>
)

export const Placeholder = () => (
  <Box style={stylesCommonRow}>
    <Box style={stylesRowBox}>
      <Icon type={placeholderIcon} style={stylePlaceholderIcon} fontSize={32} />
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
  marginLeft: globalMargins.small,
}

const rowActionIconFontSize = 16

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
  minHeight: isMobile ? 64 : 40,
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

const styleBadgeContainer = {
  position: 'absolute',
  left: isMobile ? -24 : 24,
  top: isMobile ? -20 : -1,
  zIndex: 200,
}

const styleBadgeContainerNew = {
  ...styleBadgeContainer,
  left: isMobile ? -32 : 16,
}

const styleBadgeContainerRekey = {
  ...styleBadgeContainer,
  top: isMobile ? 5 : 24,
  left: isMobile ? -40 : 16,
}

const badgeStyleCount = {
  marginLeft: 0,
  marginRight: 0,
}
