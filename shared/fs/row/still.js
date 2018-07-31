// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
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

const HoverBox = Styles.isMobile
  ? Box
  : Styles.glamorous(Box)({
      '& .fs-path-item-hover-icon': {
        color: Styles.globalColors.white,
      },
      ':hover .fs-path-item-hover-icon': {
        color: Styles.globalColors.black_40,
      },
      '& .fs-path-item-hover-icon:hover': {
        color: Styles.globalColors.black_60,
      },
    })

const RowMeta = ({badgeCount, isDownloading, isNew, isIgnored, needsRekey}) => {
  if (isIgnored || !(isDownloading || isNew || isIgnored || needsRekey || badgeCount)) {
    return null
  }

  return (
    <Box style={{width: 0, display: 'flex'}}>
      {needsRekey && (
        <Box style={styles.rekeyContainer}>
          <Meta title="rekey" backgroundColor={Styles.globalColors.red} />
        </Box>
      )}
      {isNew && (
        <Box style={styles.newContainer}>
          <Meta title="new" backgroundColor={Styles.globalColors.orange} />
        </Box>
      )}
      {isDownloading && (
        <Box style={styles.downloadContainer}>
          <Icon type="icon-addon-file-downloading" />
        </Box>
      )}
      {!!badgeCount && (
        <Box style={styles.badgeContainer}>
          <Badge height={16} fontSize={10} badgeNumber={badgeCount} />
        </Box>
      )}
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
            lineClamp={Styles.isMobile ? 1 : undefined}
          >
            {props.name}
          </Text>
          {props.isEmpty && (
            <Meta
              title="empty"
              backgroundColor={Styles.globalColors.grey}
              style={{marginLeft: Styles.globalMargins.tiny, marginTop: Styles.globalMargins.xxtiny}}
            />
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
      {!Styles.isMobile && (
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
  padding: Styles.globalMargins.tiny,
}

const pathItemActionIconFontSize = 16

const styles = Styles.styleSheetCreate({
  pathItemActionIcon: {
    padding: Styles.globalMargins.tiny,
  },
  badgeContainer: Styles.platformStyles({
    common: {
      position: 'absolute',
      zIndex: 200,
    },
    isElectron: {top: -3, left: 21},
    isMobile: {top: -1, left: -28},
  }),
  newContainer: Styles.platformStyles({
    common: {
      position: 'absolute',
      zIndex: 200,
    },
    isElectron: {top: 22, left: 16},
    isMobile: {top: -1, left: -32},
  }),
  rekeyContainer: Styles.platformStyles({
    common: {
      position: 'absolute',
      zIndex: 200,
    },
    isElectron: {top: 24, left: 16},
    isMobile: {top: 5, left: -40},
  }),
  downloadContainer: Styles.platformStyles({
    common: {
      position: 'absolute',
      zIndex: 200,
    },
    isElectron: {top: 22, left: 20},
    isMobile: {top: -1, left: -28},
  }),
})

export default Still
