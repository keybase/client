// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalColors, isMobile} from '../../styles'
import rowStyles from './styles'
import {Box, Icon, Meta, Text, Divider} from '../../common-adapters'
import PathItemIcon from '../common/path-item-icon'

type UploadingProps = {
  name: string,
  itemStyles: Types.ItemStyles,
  upload: Types.Upload,
}

const getStatusText = (upload: Types.Upload): string => {
  if (upload.error) {
    return 'Upload error'
  }
  if (upload.writingToJournal && upload.journalFlushing) {
    return 'Encrypting & Uploading'
  }
  if (upload.writingToJournal) {
    return 'Encrypting'
  }
  if (upload.journalFlushing) {
    return 'Uploading'
  }
  return 'Done'
}

const Uploading = ({name, itemStyles, upload}: UploadingProps) => (
  <Box>
    <Box style={rowStyles.row}>
      <PathItemIcon spec={itemStyles.iconSpec} style={rowStyles.pathItemIcon_30} />
      <Box style={stylesIconBadge}>
        <Icon type="icon-addon-file-uploading" />
      </Box>
      <Box key="main" style={rowStyles.itemBox}>
        <Text
          type={itemStyles.textType}
          style={rowStyles.rowText_30(itemStyles.textColor)}
          lineClamp={isMobile ? 1 : undefined}
        >
          {name}
        </Text>
        <Meta
          title={getStatusText(upload)}
          backgroundColor={upload.error ? globalColors.red : globalColors.blue}
        />
      </Box>
    </Box>
    <Divider style={rowStyles.divider} />
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
