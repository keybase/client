// @flow
import React from 'react'
import {Box, Icon, Usernames} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'

import type {Props} from './'

const Header = ({participants}: Props) => (
  <Box style={containerStyle}>
    <Usernames inline={true} type='BodyBig' users={participants.filter(p => !p.you).toArray()}
      containerStyle={{flex: 1, textAlign: 'center'}} />
    <Icon type='iconfont-folder-private' style={{marginLeft: globalMargins.tiny}} />
    <Icon type='iconfont-info' style={{marginLeft: globalMargins.tiny}} />
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxRow,
  minHeight: 32,
  borderBottom: `solid 1px ${globalColors.black_05}`,
  justifyContent: 'center',
  alignItems: 'center',
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
}

export default Header
