// @flow
import React from 'react'
import SettingsNav from './nav'

import type {Props} from './render'

function SettingsRender(props: Props) {
  return (
    <SettingsNav
      badgeNumbers={props.badgeNumbers}
      selectedTab={props.selectedTab}
      onTabChange={props.onTabChange}
      onLogout={props.onLogout}
    />
  )
}

export default SettingsRender
