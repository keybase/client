// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import {rowStyles, StillCommon, type StillCommonProps} from './common'
import {Box, Box2, Icon, Meta, Text} from '../../common-adapters'
import {PathItemInfo} from '../common'

type StillProps = StillCommonProps & {
  intentIfDownloading?: ?Types.DownloadIntent,
  isEmpty: boolean,
  lastModifiedTimestamp: number,
  lastWriter: string,
  type: Types.PathType,
}

const getDownloadingText = (intent: Types.DownloadIntent) => {
  switch (intent) {
    case 'none':
      return 'Downloading ...'
    case 'camera-roll':
      return 'Saving ...'
    case 'share':
      return 'Preparing to send to other app ...'
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (intent: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(intent);
      */
      return ''
  }
}

const Still = (props: StillProps) => (
  <StillCommon
    itemStyles={props.itemStyles}
    name={props.name}
    path={props.path}
    onOpen={props.onOpen}
    inDestinationPicker={props.inDestinationPicker}
  >
    {!!props.intentIfDownloading && (
      <Box style={styles.downloadBadgeContainer}>
        <Icon type="icon-addon-file-downloading" />
      </Box>
    )}
    <Box style={rowStyles.itemBox}>
      <Box2 direction="horizontal" fullWidth={true}>
        <Text
          type={props.itemStyles.textType}
          style={Styles.collapseStyles([rowStyles.rowText, {color: props.itemStyles.textColor}])}
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
      {props.intentIfDownloading ? (
        <Text type="BodySmall">{getDownloadingText(props.intentIfDownloading)}</Text>
      ) : (
        props.type !== 'folder' && (
          <PathItemInfo lastModifiedTimestamp={props.lastModifiedTimestamp} lastWriter={props.lastWriter} />
        )
      )}
    </Box>
  </StillCommon>
)

const downloadBadgeXOffset = -28
const downloadBadgeYOffset = Styles.isMobile ? 24 : 20
const styles = Styles.styleSheetCreate({
  downloadBadgeContainer: {
    height: 0,
    marginLeft: downloadBadgeXOffset,
    marginRight: -downloadBadgeXOffset,
    marginTop: downloadBadgeYOffset,
    width: 0,
    zIndex: 100,
  },
})

export default Still
