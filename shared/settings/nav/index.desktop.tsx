import * as React from 'react'
import * as Types from '../../constants/types/settings'
import {globalStyles, globalColors, globalMargins, platformStyles, styleSheetCreate} from '../../styles'
import {Box} from '../../common-adapters'
import SettingsItem from './settings-item'
import * as Tabs from '../../constants/tabs'
import * as Platform from '../../constants/platform'
import flags from '../../util/feature-flags'
import {Props} from './index'

const SettingsNav = (props: Props) => {
  return (
    <Box style={styles.container}>
      <SettingsItem
        text="Your account"
        selected={props.selectedTab === Types.accountTab}
        onClick={() => props.onTabChange(Types.accountTab)}
        badgeNumber={props.badgeNumbers.get(Tabs.settingsTab)}
      />
      <SettingsItem
        text="Chat"
        selected={props.selectedTab === Types.chatTab}
        onClick={() => props.onTabChange(Types.chatTab)}
      />
      {(!Platform.isLinux || flags.kbfsOfflineMode) && (
        <SettingsItem
          text="Files"
          selected={props.selectedTab === Types.fsTab}
          onClick={() => props.onTabChange(Types.fsTab)}
        />
      )}
      <SettingsItem
        text="Notifications"
        selected={props.selectedTab === Types.notificationsTab}
        onClick={() => props.onTabChange(Types.notificationsTab)}
      />
      <SettingsItem
        text="Feedback"
        selected={props.selectedTab === Types.feedbackTab}
        onClick={() => props.onTabChange(Types.feedbackTab)}
      />
      <SettingsItem
        text="Invitations"
        selected={props.selectedTab === Types.invitationsTab}
        onClick={() => props.onTabChange(Types.invitationsTab)}
      />
      <SettingsItem
        text="Advanced"
        selected={props.selectedTab === Types.advancedTab}
        onClick={() => props.onTabChange(Types.advancedTab)}
      />
      {/* TODO: Do something with logoutInProgress once Offline is
        removed from the settings page. */}
      <SettingsItem text="Sign out" selected={false} onClick={() => props.onTabChange(Types.logOutTab)} />
    </Box>
  )
}

const styles = styleSheetCreate(() => ({
  container: platformStyles({
    common: {
      ...globalStyles.flexBoxColumn,
      backgroundColor: globalColors.white,
      paddingTop: globalMargins.small,
      width: 160,
    },
    isElectron: {
      borderRight: `1px solid ${globalColors.black_10}`,
    },
  }),
}))

export default SettingsNav
