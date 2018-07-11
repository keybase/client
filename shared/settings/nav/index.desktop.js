// @flow
import * as React from 'react'
import * as Constants from '../../constants/settings'
import flags from '../../util/feature-flags'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box} from '../../common-adapters'
import SettingsItem from './settings-item'

import type {Props} from './index'

function SettingsNav({badgeNumbers, selectedTab, onTabChange, onLogout}: Props) {
  return (
    <Box style={styleNavBox}>
      <SettingsItem
        text="Your account"
        selected={selectedTab === Constants.landingTab}
        onClick={() => onTabChange(Constants.landingTab)}
      />
      <SettingsItem
        text="Invitations"
        selected={selectedTab === Constants.invitationsTab}
        onClick={() => onTabChange(Constants.invitationsTab)}
      />
      <SettingsItem
        text="Notifications"
        selected={selectedTab === Constants.notificationsTab}
        onClick={() => onTabChange(Constants.notificationsTab)}
      />
      <SettingsItem
        text="Advanced"
        selected={selectedTab === Constants.advancedTab}
        onClick={() => onTabChange(Constants.advancedTab)}
      />
      {flags.fsEnabled && (
        <SettingsItem
          text="Files"
          selected={selectedTab === Constants.fsTab}
          onClick={() => onTabChange(Constants.fsTab)}
        />
      )}
      <SettingsItem
        text="Delete me"
        selected={selectedTab === Constants.deleteMeTab}
        onClick={() => onTabChange(Constants.deleteMeTab)}
      />
      <SettingsItem text="Sign out" selected={false} onClick={onLogout} />
      {__DEV__ && (
        <SettingsItem
          text="😎 &nbsp; Dev Menu"
          selected={selectedTab === Constants.devMenuTab}
          onClick={() => onTabChange(Constants.devMenuTab)}
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
