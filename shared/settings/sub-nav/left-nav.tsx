import * as C from '../../constants'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as TabConstants from '../../constants/tabs'
import WhatsNewIcon from '../../whats-new/icon/container'
import SettingsItem from './settings-item'
import {keybaseFM} from '../../constants/whats-new'

type Props = {
  onClick: (s: string) => void
  navigate: (s: string) => void
  selected: string
  contactsLabel?: string
}

const LeftNav = (props: Props) => {
  const badgeNumbers = C.useNotifState(s => s.navBadges)
  const badgeNotifications = C.usePushState(s => !s.hasPermissions)
  return (
    <Kb.ScrollView style={styles.container}>
      {Styles.isTablet && (
        <>
          <SettingsItem
            icon="iconfont-nav-2-crypto"
            text="Crypto"
            selected={props.selected === C.settingsCryptoTab}
            onClick={() => props.onClick(C.settingsCryptoTab)}
            badgeNumber={badgeNumbers.get(TabConstants.cryptoTab)}
          />
          <SettingsItem
            icon="iconfont-nav-2-git"
            text="Git"
            selected={props.selected === C.settingsGitTab}
            onClick={() => props.onClick(C.settingsGitTab)}
            badgeNumber={badgeNumbers.get(TabConstants.gitTab)}
          />
          <SettingsItem
            text="Devices"
            icon="iconfont-nav-2-devices"
            selected={props.selected === C.settingsDevicesTab}
            onClick={() => props.onClick(C.settingsDevicesTab)}
            badgeNumber={badgeNumbers.get(TabConstants.devicesTab)}
          />

          <SettingsItem
            text={keybaseFM}
            iconComponent={WhatsNewIcon as any}
            selected={props.selected === C.settingsWhatsNewTab}
            onClick={() => props.onClick(C.settingsWhatsNewTab)}
          />
          <Kb.SectionDivider label="Settings" />
        </>
      )}
      <SettingsItem
        text="Your account"
        selected={props.selected === C.settingsAccountTab}
        onClick={() => props.onClick(C.settingsAccountTab)}
        badgeNumber={badgeNumbers.get(TabConstants.settingsTab)}
      />
      <SettingsItem
        text="Chat"
        selected={props.selected === C.settingsChatTab}
        onClick={() => props.onClick(C.settingsChatTab)}
      />
      {Styles.isTablet && props.contactsLabel && (
        <SettingsItem
          text={props.contactsLabel}
          selected={props.selected === C.settingsContactsTab}
          onClick={() => props.onClick(C.settingsContactsTab)}
        />
      )}
      <SettingsItem
        text="Files"
        selected={props.selected === C.settingsFsTab}
        onClick={() => props.onClick(C.settingsFsTab)}
      />
      <SettingsItem
        badgeNumber={badgeNotifications ? 1 : 0}
        text="Notifications"
        selected={props.selected === C.settingsNotificationsTab}
        onClick={() => props.onClick(C.settingsNotificationsTab)}
      />
      <SettingsItem
        text="Display"
        selected={props.selected === C.settingsDisplayTab}
        onClick={() => props.onClick(C.settingsDisplayTab)}
      />
      {Styles.isTablet && (
        <SettingsItem
          text="About"
          selected={props.selected === C.settingsAboutTab}
          onClick={() => props.onClick(C.settingsAboutTab)}
        />
      )}
      <SettingsItem
        text="Feedback"
        selected={props.selected === C.settingsFeedbackTab}
        onClick={() => props.onClick(C.settingsFeedbackTab)}
      />
      {!Styles.isTablet && (
        <SettingsItem
          text="Invitations"
          selected={props.selected === C.settingsInvitationsTab}
          onClick={() => props.onClick(C.settingsInvitationsTab)}
        />
      )}
      <SettingsItem
        text="Advanced"
        selected={props.selected === C.settingsAdvancedTab}
        onClick={() => props.onClick(C.settingsAdvancedTab)}
      />
      {/* TODO: Do something with logoutInProgress once Offline is
        removed from the settings page. */}
      <SettingsItem
        text="Sign out"
        selected={false}
        onClick={() => {
          props.navigate(C.settingsLogOutTab)
        }}
      />
    </Kb.ScrollView>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      backgroundColor: Styles.globalColors.blueGrey,
    },
    isElectron: {
      height: '100%',
      paddingTop: Styles.globalMargins.small,
    },
  }),
}))

export default LeftNav
