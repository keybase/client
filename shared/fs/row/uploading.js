// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import {rowStyles} from './common'
import {Box, Icon, Meta, Text} from '../../common-adapters'
import PathItemIcon from '../common/path-item-icon'

type UploadingProps = {
  name: string,
  itemStyles: Types.ItemStyles,
  error: boolean,
  writingToJournal: boolean,
  syncing: boolean,
}

const getStatusText = ({error, writingToJournal, syncing}: UploadingProps): string => {
  if (error) {
    return 'Upload error'
  }
  if (writingToJournal && syncing) {
    return 'Encrypting & Uploading'
  }
  if (writingToJournal) {
    return 'Encrypting'
  }
  if (syncing) {
    return 'Uploading'
  }
  return 'Done'
}

const Uploading = (props: UploadingProps) => (
  <Box style={rowStyles.rowBox}>
    <PathItemIcon spec={props.itemStyles.iconSpec} style={rowStyles.pathItemIcon_30} />
    <Box style={stylesIconBadge}>
      <Icon type="icon-addon-file-uploading" />
    </Box>
    <Box key="main" style={rowStyles.itemBox}>
      <Text
        type={props.itemStyles.textType}
        style={Styles.collapseStyles([rowStyles.rowText_30, {color: props.itemStyles.textColor}])}
        lineClamp={Styles.isMobile ? 1 : undefined}
      >
        {props.name}
      </Text>
      <Meta
        title={getStatusText(props)}
        backgroundColor={props.error ? Styles.globalColors.red : Styles.globalColors.blue}
      />
    </Box>
  </Box>
)

const xOffset = -28
const yOffset = 20
const stylesIconBadge = {
  marginLeft: xOffset,
  marginRight: -xOffset,
  marginTop: yOffset,
  width: 0,
  zIndex: 100,
}

export default Uploading
