// @flow
import * as React from 'react'
import * as Constants from '../../constants/settings'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box} from '../../common-adapters'
import SettingsItem from './settings-item'

import type {Props} from './index'

function SettingsNav(props: Props) {
  return (
    <Box style={styleNavBox}>
      <SettingsItem
        text="Your account"
        selected={props.selectedTab === Constants.landingTab}
        onClick={() => props.onTabChange(Constants.landingTab)}
      />
      <SettingsItem
        text="Invitations"
        selected={props.selectedTab === Constants.invitationsTab}
        onClick={() => props.onTabChange(Constants.invitationsTab)}
      />
      <SettingsItem
        text="Notifications"
        selected={props.selectedTab === Constants.notificationsTab}
        onClick={() => props.onTabChange(Constants.notificationsTab)}
      />
      <SettingsItem
        text="Advanced"
        selected={props.selectedTab === Constants.advancedTab}
        onClick={() => props.onTabChange(Constants.advancedTab)}
      />
      <SettingsItem
        text="Files"
        selected={props.selectedTab === Constants.fsTab}
        onClick={() => props.onTabChange(Constants.fsTab)}
      />
      <SettingsItem
        text="Delete me"
        selected={props.selectedTab === Constants.deleteMeTab}
        onClick={() => props.onTabChange(Constants.deleteMeTab)}
      />
      <SettingsItem text="Sign out" selected={false} onClick={props.onLogout} />
      {__DEV__ && (
        <SettingsItem
          text="😎 &nbsp; Dev Menu"
          selected={props.selectedTab === Constants.devMenuTab}
          onClick={() => props.onTabChange(Constants.devMenuTab)}
        />
      )}
    </Box>
  )
}
const styleNavBox = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  borderRight: '1px solid ' + globalColors.black_05,
  paddingTop: globalMargins.small,
  width: 160,
}

export default SettingsNav
