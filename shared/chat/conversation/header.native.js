// @flow
import React from 'react'
import {BackButton, Box, Icon, Usernames} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'

import type {Props} from './header'

const Header = ({muted, onBack, onOpenFolder, onShowProfile, onToggleSidePanel, sidePanelOpen, users}: Props) => (
  <Box style={containerStyle}>
    <Box style={{...globalStyles.flexBoxRow, flex: 1, justifyContent: 'flex-start'}}>
      <BackButton title={null} onClick={onBack} iconStyle={{color: globalColors.blue}} textStyle={{color: globalColors.blue}} />
    </Box>
    <Box style={{...globalStyles.flexBoxRow, justifyContent: 'center'}}>
      <Usernames
        colorFollowing={true}
        inline={false}
        commaColor={globalColors.black_40}
        type='BodyBig'
        users={users}
        containerStyle={styleCenter}
        onUsernameClicked={onShowProfile} />
      {muted && <Icon type='iconfont-shh' style={{...styleCenter, ...styleLeft}} />}
    </Box>
    <Box style={{...globalStyles.flexBoxRow, flex: 1, justifyContent: 'flex-end'}}>
      <Icon type={sidePanelOpen ? 'iconfont-close' : 'iconfont-info'} style={styleLeft} onClick={onToggleSidePanel} />
    </Box>
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 32,
  padding: globalMargins.tiny,
}

const styleCenter = {
  justifyContent: 'center',
  textAlign: 'center',
}

const styleLeft = {
  marginLeft: globalMargins.tiny,
}

export default Header
