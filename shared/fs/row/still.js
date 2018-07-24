// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalColors, globalMargins, isMobile, glamorous} from '../../styles'
import rowStyles from './styles'
import {Badge, Box, Box2, ClickableBox, Icon, Meta, Text} from '../../common-adapters'
import PathItemIcon from '../common/path-item-icon'
import PathItemInfo from '../common/path-item-info'
import PathItemAction from '../common/path-item-action-container'

type StillProps = {
  path: Types.Path,
  name: string,
  type: Types.PathType,
  lastModifiedTimestamp: number,
  lastWriter: string,
  itemStyles: Types.ItemStyles,
  badgeCount: number,
  isDownloading?: boolean,
  tlfMeta?: Types.FavoriteMetadata,
  resetParticipants: Array<string>,
  isEmpty: boolean,
  isUserReset: boolean,
  onOpen: () => void,
  openInFileUI: () => void,
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
  <HoverBox style={rowStyles.rowBox}>
    <ClickableBox onClick={props.onOpen} style={rowStyles.leftBox}>
      <Box2 direction="vertical">
        <PathItemIcon spec={props.itemStyles.iconSpec} style={rowStyles.pathItemIcon} />
      </Box2>
      <RowMeta badgeCount={props.badgeCount} {...props.tlfMeta} isDownloading={props.isDownloading} />
      <Box style={rowStyles.itemBox}>
        <Box2 direction="horizontal" fullWidth={true}>
          <Text
            type={props.itemStyles.textType}
            style={rowStyles.rowText(props.itemStyles.textColor)}
            lineClamp={isMobile ? 1 : undefined}
          >
            {props.name}
          </Text>
          {props.isEmpty && (
            <Meta title="empty" backgroundColor={globalColors.grey} style={{marginLeft: globalMargins.tiny, marginTop: globalMargins.xxtiny}} />
          )}
        </Box2>
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
          style={pathItemActionIconStyle}
          fontSize={pathItemActionIconFontSize}
          onClick={props.openInFileUI}
          className="fs-path-item-hover-icon"
        />
      )}
      <PathItemAction path={props.path} actionIconClassName="fs-path-item-hover-icon" />
    </Box>
  </HoverBox>
)

const pathItemActionIconStyle = {
  padding: globalMargins.tiny,
}

const pathItemActionIconFontSize = 16

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
  top: isMobile ? 2 : 22,
  left: isMobile ? -28 : 20,
}

const badgeStyleCount = {
  marginLeft: 0,
  marginRight: 0,
}

export default Still
