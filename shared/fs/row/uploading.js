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
}

const Uploading = (props: UploadingProps) => (
  <Box>
    <Box style={rowStyles.row}>
      <PathItemIcon spec={props.itemStyles.iconSpec} style={rowStyles.pathItemIcon_30} />
      <Box style={stylesIconBadge}>
        <Icon type="iconfont-upload" color={globalColors.blue} />
      </Box>
      <Box key="main" style={rowStyles.itemBox}>
        <Text
          type={props.itemStyles.textType}
          style={rowStyles.rowText_30(props.itemStyles.textColor)}
          lineClamp={isMobile ? 1 : undefined}
        >
          {props.name}
        </Text>
        <Meta title="Encrypting & Uploading" backgroundColor={globalColors.blue} />
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
