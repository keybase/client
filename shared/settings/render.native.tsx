import * as React from 'react'
import SettingsNav from './nav'

import {Props} from './render'

function SettingsRender(props: Props) {
  return (
    <SettingsNav
      badgeNotifications={props.badgeNotifications}
      badgeNumbers={props.badgeNumbers}
      contactsLabel={props.contactsLabel}
      logoutInProgress={props.logoutInProgress}
      selectedTab={props.selectedTab}
      onTabChange={props.onTabChange}
      onLogout={props.onLogout}
      hasRandomPW={props.hasRandomPW || null}
    />
  )
}

export default SettingsRender
