// @flow
import React from 'react'
import SettingsNav from './nav'
import {Box} from '../common-adapters'
import {globalStyles} from '../styles'

import type {Props} from './render'

function SettingsRender (props: Props) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <SettingsNav badgeNumbers={props.badgeNumbers} selectedTab={props.selectedTab} onTabChange={props.onTabChange} onLogout={props.onLogout} />
    </Box>
  )
}

export default SettingsRender
