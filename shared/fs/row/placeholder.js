// @flow
import * as React from 'react'
import {globalColors, globalMargins, isMobile} from '../../styles'
import rowStyles from './styles'
import {Box, Icon} from '../../common-adapters'

const Placeholder = () => (
  <Box style={rowStyles.row}>
    <Box style={rowStyles.rowBox}>
      <Icon type={placeholderIcon} style={stylePlaceholderIcon} fontSize={32} />
      <Box style={rowStyles.itemBox}>
        <Box style={placeholderTextStyle} />
      </Box>
    </Box>
  </Box>
)

const placeholderIcon = isMobile ? 'iconfont-folder-private' : 'iconfont-folder-private'

const placeholderTextStyle = {
  backgroundColor: globalColors.lightGrey,
  height: 16,
  marginTop: 4,
  width: 256,
}

const stylePlaceholderIcon = {
  marginRight: globalMargins.small,
}

export default Placeholder
