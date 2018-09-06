// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import {rowStyles, StillCommon, type StillCommonProps} from './common'
import {Box, Box2, Icon, Meta, Text} from '../../common-adapters'
import PathItemInfo from '../common/path-item-info'

type StillProps = StillCommonProps & {
  isDownloading?: boolean,
  isEmpty: boolean,
  lastModifiedTimestamp: number,
  lastWriter: string,
  type: Types.PathType,
}

const RowMeta = ({isDownloading}) => {
  if (!isDownloading) {
    return null
  }

  return (
    <Box style={{width: 0, display: 'flex'}}>
      {isDownloading && (
        <Box style={rowStyles.downloadContainer}>
          <Icon type="icon-addon-file-downloading" />
        </Box>
      )}
    </Box>
  )
}

const Still = (props: StillProps) => (
  <StillCommon itemStyles={props.itemStyles} name={props.name} path={props.path} onOpen={props.onOpen}>
    <RowMeta isDownloading={props.isDownloading} />
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
      {props.type !== 'folder' && (
        <PathItemInfo lastModifiedTimestamp={props.lastModifiedTimestamp} lastWriter={props.lastWriter} />
      )}
    </Box>
  </StillCommon>
)

export default Still
