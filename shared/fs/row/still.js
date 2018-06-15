// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalColors, globalMargins, isMobile, glamorous} from '../../styles'
import rowStyles from './styles'
import {Badge, Box, ClickableBox, Icon, Meta, Text, Divider} from '../../common-adapters'
import PathItemIcon from '../common/path-item-icon'
import PathItemInfo from '../common/path-item-info'

type StillProps = {
  name: string,
  type: Types.PathType,
  lastModifiedTimestamp: number,
  lastWriter: string,
  shouldShowMenu: boolean,
  itemStyles: Types.ItemStyles,
  badgeCount: number,
  isDownloading?: boolean,
  tlfMeta?: Types.FavoriteMetadata,
  resetParticipants: Array<string>,
  isUserReset: boolean,
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

const RowMeta = ({badgeCount, isDownloading, isNew, isIgnored, needsRekey}) => {
  if (isIgnored || !(isDownloading || isNew || isIgnored || needsRekey || badgeCount)) {
    return null
  }

  return (
    <Box style={{width: 0, display: 'flex'}}>
      {needsRekey && (
        <Box style={styleBadgeContainerRekey}>
          <Meta title="rekey" backgroundColor={globalColors.red} />
        </Box>
      )}
      {isNew && (
        <Box style={styleBadgeContainerNew}>
          <Meta title="new" backgroundColor={globalColors.orange} />
        </Box>
      )}
      {isDownloading && (
        <Box style={styleDownloadContainer}>
          <Icon type="icon-addon-file-downloading" />
        </Box>
      )}
      <Box style={styleBadgeContainer}>
        {!!badgeCount && <Badge badgeNumber={badgeCount} badgeStyle={badgeStyleCount} />}
      </Box>
    </Box>
  )
}

const Still = (props: StillProps) => (
  <Box>
    <HoverBox style={rowStyles.row}>
      <ClickableBox onClick={props.onOpen} style={rowStyles.rowBox}>
        <PathItemIcon spec={props.itemStyles.iconSpec} style={rowStyles.pathItemIcon} />
        <RowMeta badgeCount={props.badgeCount} {...props.tlfMeta} isDownloading={props.isDownloading} />
        <Box style={rowStyles.itemBox}>
          <Text
            type={props.itemStyles.textType}
            style={rowStyles.rowText(props.itemStyles.textColor)}
            lineClamp={isMobile ? 1 : undefined}
          >
            {props.name}
          </Text>
          {props.type === 'folder' &&
          (!props.resetParticipants || props.resetParticipants.length === 0) ? null : (
            <PathItemInfo
              lastModifiedTimestamp={props.lastModifiedTimestamp}
              lastWriter={props.lastWriter}
              resetParticipants={props.resetParticipants}
              isUserReset={props.isUserReset}
            />
          )}
        </Box>
      </ClickableBox>
      <Box style={rowStyles.rightBox}>
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
    <Divider style={rowStyles.divider} />
  </Box>
)

const rowActionIconStyle = {
  marginLeft: globalMargins.small,
}

const rowActionIconFontSize = 16

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

const styleDownloadContainer = {
  ...styleBadgeContainer,
  top: 22,
  left: 20,
}

const badgeStyleCount = {
  marginLeft: 0,
  marginRight: 0,
}

export default Still
