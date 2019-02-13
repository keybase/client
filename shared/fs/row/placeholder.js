// @flow
import * as React from 'react'
import {rowStyles} from './common'
import {Box, Icon, Placeholder} from '../../common-adapters'

type PlaceholderProps = {
  type: 'folder' | 'file',
}

export default ({type}: PlaceholderProps) => (
  <Box style={rowStyles.rowBox}>
    <Icon
      type={type === 'folder' ? 'icon-folder-placeholder-32' : 'icon-file-placeholder-32'}
      style={rowStyles.pathItemIcon}
    />
    <Box style={rowStyles.itemBox}>
      <Placeholder style={placeholderTextStyle} />
    </Box>
  </Box>
)

const placeholderTextStyle = {
  marginTop: 4,
}
