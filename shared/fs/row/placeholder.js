// @flow
import * as React from 'react'
import {globalColors} from '../../styles'
import {rowStyles} from './common'
import {Box, Icon} from '../../common-adapters'

type PlaceholderProps = {
  type: 'folder' | 'file',
}

const Placeholder = ({type}: PlaceholderProps) => (
  <Box style={rowStyles.rowBox}>
    <Icon
      type={type === 'folder' ? 'icon-folder-placeholder-32' : 'icon-file-placeholder-32'}
      style={rowStyles.pathItemIcon}
    />
    <Box style={rowStyles.itemBox}>
      <Box style={placeholderTextStyle} />
    </Box>
  </Box>
)

const placeholderTextStyle = {
  backgroundColor: globalColors.lightGrey,
  height: 16,
  marginTop: 4,
  width: 256,
}

export default Placeholder
