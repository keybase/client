import * as React from 'react'
import * as Constants from '../../constants/settings'
import * as Styles from '../../styles'
import {Box} from '../../common-adapters'
import SettingsItem from './settings-item'
import * as Tabs from '../../constants/tabs'
import {Props} from './index'

const SettingsNav = (props: Props) => {
  return (
    <Box style={styles.container}>
      <SettingsItem
        text="Your account"
        selected={props.selectedTab === Constants.accountTab}
        onClick={() => props.onTabChange(Constants.accountTab)}
        badgeNumber={props.badgeNumbers.get(Tabs.settingsTab)}
      />
      <SettingsItem
        text="Chat"
        selected={props.selectedTab === Constants.chatTab}
        onClick={() => props.onTabChange(Constants.chatTab)}
      />
      <SettingsItem
        text="Files"
        selected={props.selectedTab === Constants.fsTab}
        onClick={() => props.onTabChange(Constants.fsTab)}
      />
      <SettingsItem
        text="Notifications"
        selected={props.selectedTab === Constants.notificationsTab}
        onClick={() => props.onTabChange(Constants.notificationsTab)}
      />
      <SettingsItem
        text="Display"
        selected={props.selectedTab === Constants.displayTab}
        onClick={() => props.onTabChange(Constants.displayTab)}
      />
      <SettingsItem
        text="Feedback"
        selected={props.selectedTab === Constants.feedbackTab}
        onClick={() => props.onTabChange(Constants.feedbackTab)}
      />
      <SettingsItem
        text="Invitations"
        selected={props.selectedTab === Constants.invitationsTab}
        onClick={() => props.onTabChange(Constants.invitationsTab)}
      />
      <SettingsItem
        text="Advanced"
        selected={props.selectedTab === Constants.advancedTab}
        onClick={() => props.onTabChange(Constants.advancedTab)}
      />
      {/* TODO: Do something with logoutInProgress once Offline is
        removed from the settings page. */}
      <SettingsItem text="Sign out" selected={false} onClick={() => props.onTabChange(Constants.logOutTab)} />
    </Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    backgroundColor: Styles.globalColors.blueGrey,
    paddingTop: Styles.globalMargins.small,
    width: 160,
  },
}))

export default SettingsNav
