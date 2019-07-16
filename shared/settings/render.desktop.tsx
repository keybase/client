import * as React from 'react'
import SettingsNav from './nav'
import {Box} from '../common-adapters'
import {globalStyles} from '../styles'

import {Props} from './render'

function SettingsRender(props: Props) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
        <SettingsNav
          badgeNumbers={props.badgeNumbers}
          logoutInProgress={props.logoutInProgress}
          selectedTab={props.selectedTab}
          onTabChange={props.onTabChange}
          onLogout={props.onLogout}
          hasRandomPW={props.hasRandomPW || null}
        />
        <Box style={{...globalStyles.flexBoxRow, flex: 1, overflow: 'auto'}}>{props.children}</Box>
      </Box>
    </Box>
  )
}

export default SettingsRender
