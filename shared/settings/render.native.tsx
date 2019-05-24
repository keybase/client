import * as React from 'react'
import SettingsNav from './nav'

import {Props} from './render'

function SettingsRender(props: Props) {
  return (
    <SettingsNav
      badgeNotifications={props.badgeNotifications}
      badgeNumbers={props.badgeNumbers}
      logoutInProgress={props.logoutInProgress}
      selectedTab={props.selectedTab}
      onTabChange={props.onTabChange}
      onLogout={props.onLogout}
      hasRandomPW={props.hasRandomPW}
    />
  )
}

export default SettingsRender
