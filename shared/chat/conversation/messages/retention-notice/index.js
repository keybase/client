// @flow
import * as React from 'react'
import {Box, Icon} from '../../../../common-adapters/'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../../styles'

export type Props = {}

const iconType = isMobile ? 'icon-message-retention-48' : 'icon-message-retention-32'

export default (props: Props) => (
  <Box style={containerStyle}>
    <Icon type={iconType} />
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.blue5,
  paddingBottom: globalMargins.small,
  paddingTop: globalMargins.small,
  width: '100%',
}
