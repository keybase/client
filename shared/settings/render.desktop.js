// @flow
import React from 'react'
import SettingsNav from './nav'
import {Box} from '../common-adapters'
import {globalStyles, globalColors} from '../styles'
import SettingsHelp from './help.desktop'

import type {Props} from './render'

function SettingsRender (props: Props) {
  if (props.showComingSoon) {
    return <SettingsHelp />
  }

  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
        {!props.isModal && <SettingsNav badgeNumbers={props.badgeNumbers} selectedTab={props.selectedTab} onTabChange={props.onTabChange} />}
        <Box style={{...globalStyles.flexBoxRow, flex: 1, overflow: 'auto'}}>
          {props.children}
        </Box>
      </Box>
    </Box>
  )
}

export default SettingsRender
