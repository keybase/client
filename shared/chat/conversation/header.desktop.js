// @flow
import React from 'react'
import {Box, Icon, Usernames} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {participantFilter} from '../../constants/chat'

import type {Props} from './'

const Header = ({participants, onOpenFolder, toggleSidePanel, sidePanelOpen}: Props) => (
  <Box style={containerStyle}>
    <Usernames inline={false} type='BodyBig' users={participantFilter(participants).toArray()}
      containerStyle={{flex: 1, textAlign: 'center', justifyContent: 'center'}} />
    <Icon type='iconfont-folder-private' style={{marginLeft: globalMargins.tiny}} onClick={onOpenFolder} />
    <Icon type={sidePanelOpen ? 'iconfont-close' : 'iconfont-info'} style={{marginLeft: globalMargins.tiny}} onClick={toggleSidePanel} />
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxRow,
  minHeight: 32,
  borderBottom: `solid 1px ${globalColors.black_05}`,
  justifyContent: 'center',
  alignItems: 'center',
  padding: globalMargins.tiny,
}

export default Header
