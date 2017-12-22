// @flow
import * as React from 'react'
import {Badge, Box, Icon} from '../../common-adapters'
import {type IconType} from '../../common-adapters/icon.constants'
import {globalColors, globalStyles, globalMargins} from '../../styles'

export type Props = {
  badged: boolean,
  icon: IconType,
  children: React.Node,
}

export default (props: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxRow,
      width: '100%',
      backgroundColor: props.badged ? globalColors.blue4 : globalColors.white,
      paddingTop: globalMargins.tiny,
      paddingLeft: 12,
      paddingBottom: globalMargins.tiny,
    }}
  >
    <Icon type={props.icon} style={{marginRight: 20, width: 32, height: 32}} />
    <Box style={globalStyles.flexBoxColumn}>
      {props.children}
    </Box>
    {props.badged && <Badge badgeNumber={null} badgeStyle={{position: 'absolute', right: 8, top: 12}} />}
  </Box>
)
