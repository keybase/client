import * as React from 'react'
import * as Constants from '../../constants/settings'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as TabConstants from '../../constants/tabs'
import WhatsNewIcon from '../../whats-new/icon/container'
import SettingsItem from './settings-item'
import {keybaseFM} from '../../constants/whats-new'
import {Props} from './index'

const SplitNav = (props: Props) => {
  return (
    <Kb.ScrollView style={styles.container}>
      {Styles.isTablet && (
        <>
          <SettingsItem
            icon="iconfont-nav-2-crypto"
            text="Crypto"
            selected={props.selectedTab === Constants.cryptoTab}
            onClick={() => props.onTabChange(Constants.cryptoTab)}
            badgeNumber={props.badgeNumbers.get(TabConstants.cryptoTab)}
          />
          <SettingsItem
            icon="iconfont-nav-2-git"
            text="Git"
            selected={props.selectedTab === Constants.gitTab}
            onClick={() => props.onTabChange(Constants.gitTab)}
            badgeNumber={props.badgeNumbers.get(TabConstants.gitTab)}
          />
          <SettingsItem
            text="Devices"
            icon="iconfont-nav-2-devices"
            selected={props.selectedTab === Constants.devicesTab}
            onClick={() => props.onTabChange(Constants.devicesTab)}
            badgeNumber={props.badgeNumbers.get(TabConstants.devicesTab)}
          />

          <SettingsItem
            text={keybaseFM}
            iconComponent={WhatsNewIcon}
            selected={props.selectedTab === Constants.whatsNewTab}
            onClick={() => props.onTabChange(Constants.whatsNewTab)}
          />
          <Kb.SectionDivider label="Settings" />
        </>
      )}
      <SettingsItem
        text="Your account"
        selected={props.selectedTab === Constants.accountTab}
        onClick={() => props.onTabChange(Constants.accountTab)}
        badgeNumber={props.badgeNumbers.get(TabConstants.settingsTab)}
      />
      <SettingsItem
        text="Chat"
        selected={props.selectedTab === Constants.chatTab}
        onClick={() => props.onTabChange(Constants.chatTab)}
      />
      {Styles.isTablet && props.contactsLabel && (
        <SettingsItem
          text={props.contactsLabel}
          selected={props.selectedTab === Constants.contactsTab}
          onClick={() => props.onTabChange(Constants.contactsTab)}
        />
      )}
      <SettingsItem
        text="Files"
        selected={props.selectedTab === Constants.fsTab}
        onClick={() => props.onTabChange(Constants.fsTab)}
      />
      <SettingsItem
        badgeNumber={props.badgeNotifications ? 1 : 0}
        text="Notifications"
        selected={props.selectedTab === Constants.notificationsTab}
        onClick={() => props.onTabChange(Constants.notificationsTab)}
      />
      <SettingsItem
        text="Display"
        selected={props.selectedTab === Constants.displayTab}
        onClick={() => props.onTabChange(Constants.displayTab)}
      />
      {Styles.isTablet && (
        <SettingsItem
          text="About"
          selected={props.selectedTab === Constants.aboutTab}
          onClick={() => props.onTabChange(Constants.aboutTab)}
        />
      )}
      <SettingsItem
        text="Feedback"
        selected={props.selectedTab === Constants.feedbackTab}
        onClick={() => props.onTabChange(Constants.feedbackTab)}
      />
      {!Styles.isTablet && (
        <SettingsItem
          text="Invitations"
          selected={props.selectedTab === Constants.invitationsTab}
          onClick={() => props.onTabChange(Constants.invitationsTab)}
        />
      )}
      <SettingsItem
        text="Advanced"
        selected={props.selectedTab === Constants.advancedTab}
        onClick={() => props.onTabChange(Constants.advancedTab)}
      />
      {/* TODO: Do something with logoutInProgress once Offline is
        removed from the settings page. */}
      <SettingsItem text="Sign out" selected={false} onClick={() => props.onTabChange(Constants.logOutTab)} />
    </Kb.ScrollView>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      backgroundColor: Styles.globalColors.blueGrey,
      maxWidth: Constants.settingsSubNavWidth,
      width: Constants.settingsSubNavWidth,
    },
    isElectron: {
      paddingTop: Styles.globalMargins.small,
    },
  }),
}))

export default SplitNav
