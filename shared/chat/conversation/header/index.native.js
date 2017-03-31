// @flow
import React from 'react'
import {BackButton, Box, Icon, Usernames} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'

import type {Props} from '.'

const Header = ({muted, onBack, onOpenFolder, onShowProfile, onToggleSidePanel, sidePanelOpen, users}: Props) => (
  <Box style={containerStyle}>
    <BackButton title={null} onClick={onBack} iconStyle={{color: globalColors.blue}} textStyle={{color: globalColors.blue}} style={{flexShrink: 0}} />
    <Box style={{...globalStyles.flexBoxRow, justifyContent: 'center', flex: 1, marginTop: 2}}>
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
    <Icon type={sidePanelOpen ? 'iconfont-close' : 'iconfont-info'} style={{...styleLeft, flexShrink: 0, padding: globalMargins.xtiny}} onClick={onToggleSidePanel} />
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
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
