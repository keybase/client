import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import SettingsItem from './settings-item'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import * as Settings from '@/constants/settings'
import {usePushState} from '@/stores/push'
import {useNotifState} from '@/stores/notifications'

type Props = {
  onClick: (s: string) => void
  navigate: (s: string) => void
  selected: string
  contactsLabel?: string
}

const LeftNav = (props: Props) => {
  const styles = useStyles()
  const {navigate} = props
  const badgeNumbers = useNotifState(s => s.navBadges)
  const badgeNotifications = usePushState(s => (isElectron ? 0 : !s.hasPermissions ? 1 : 0))

  return (
    <Kb.ScrollView style={styles.container} testID={TestIDs.SETTINGS_ACCOUNT}>
      {Kb.Styles.isTablet && (
        <>
          <SettingsItem
            icon="iconfont-nav-2-crypto"
            text="Crypto"
            type={Settings.settingsCryptoTab}
            selected={props.selected === Settings.settingsCryptoTab}
            onClick={props.onClick}
            badgeNumber={badgeNumbers.get(C.Tabs.cryptoTab)}
          />
          <SettingsItem
            icon="iconfont-nav-2-git"
            text="Git"
            type={Settings.settingsGitTab}
            selected={props.selected === Settings.settingsGitTab}
            onClick={props.onClick}
            badgeNumber={badgeNumbers.get(C.Tabs.gitTab)}
          />
          <SettingsItem
            text="Devices"
            icon="iconfont-nav-2-devices"
            type={Settings.settingsDevicesTab}
            selected={props.selected === Settings.settingsDevicesTab}
            onClick={props.onClick}
            badgeNumber={badgeNumbers.get(C.Tabs.devicesTab)}
          />
          <Kb.SectionDivider label="Settings" />
        </>
      )}
      <SettingsItem
        text="Account"
        testID={TestIDs.SETTINGS_ROW_ACCOUNT}
        selected={props.selected === Settings.settingsAccountTab}
        type={Settings.settingsAccountTab}
        onClick={props.onClick}
        badgeNumber={badgeNumbers.get(C.Tabs.settingsTab)}
      />
      <SettingsItem
        text="Advanced"
        testID={TestIDs.SETTINGS_ROW_ADVANCED}
        type={Settings.settingsAdvancedTab}
        selected={props.selected === Settings.settingsAdvancedTab}
        onClick={props.onClick}
      />
      <SettingsItem
        text="Backup"
        testID={TestIDs.SETTINGS_ROW_ARCHIVE}
        type={Settings.settingsArchiveTab}
        selected={props.selected === Settings.settingsArchiveTab}
        onClick={props.onClick}
      />
      <SettingsItem
        text="Chat"
        testID={TestIDs.SETTINGS_ROW_CHAT}
        type={Settings.settingsChatTab}
        selected={props.selected === Settings.settingsChatTab}
        onClick={props.onClick}
      />
      {Kb.Styles.isTablet && props.contactsLabel && (
        <SettingsItem
          text={props.contactsLabel}
          type={Settings.settingsContactsTab}
          selected={props.selected === Settings.settingsContactsTab}
          onClick={props.onClick}
        />
      )}
      <SettingsItem
        text="Display"
        testID={TestIDs.SETTINGS_ROW_DISPLAY}
        type={Settings.settingsDisplayTab}
        selected={props.selected === Settings.settingsDisplayTab}
        onClick={props.onClick}
      />
      <SettingsItem
        text="Feedback"
        testID={TestIDs.SETTINGS_ROW_FEEDBACK}
        type={Settings.settingsFeedbackTab}
        selected={props.selected === Settings.settingsFeedbackTab}
        onClick={props.onClick}
      />
      <SettingsItem
        text="Files"
        testID={TestIDs.SETTINGS_ROW_FILES}
        type={Settings.settingsFsTab}
        selected={props.selected === Settings.settingsFsTab}
        onClick={props.onClick}
      />
      <SettingsItem
        badgeNumber={badgeNotifications}
        text="Notifications"
        testID={TestIDs.SETTINGS_ROW_NOTIFICATIONS}
        type={Settings.settingsNotificationsTab}
        selected={props.selected === Settings.settingsNotificationsTab}
        onClick={props.onClick}
      />
      {!Kb.Styles.isTablet && (
        <SettingsItem
          text="Screen protector"
          testID={TestIDs.SETTINGS_ROW_SCREENPROTECTOR}
          type={Settings.settingsScreenprotectorTab}
          selected={props.selected === Settings.settingsScreenprotectorTab}
          onClick={props.onClick}
        />
      )}
      <SettingsItem
        text="Wallet"
        testID={TestIDs.SETTINGS_ROW_WALLET}
        type={Settings.settingsWalletsTab}
        selected={props.selected === Settings.settingsWalletsTab}
        onClick={props.onClick}
      />
      {__DEV__ && (
        <SettingsItem
          text="Typography"
          testID={TestIDs.SETTINGS_ROW_TYPOGRAPHY}
          type={Settings.settingsTypographyTab}
          selected={props.selected === Settings.settingsTypographyTab}
          onClick={props.onClick}
        />
      )}
      {__DEV__ && (
        <SettingsItem
          text="Icons"
          testID={TestIDs.SETTINGS_ROW_ICONS}
          type={Settings.settingsIconsTab}
          selected={props.selected === Settings.settingsIconsTab}
          onClick={props.onClick}
        />
      )}
      {__DEV__ && (
        <SettingsItem
          text="Markdown"
          testID={TestIDs.SETTINGS_ROW_MARKDOWN}
          type={Settings.settingsMarkdownTab}
          selected={props.selected === Settings.settingsMarkdownTab}
          onClick={props.onClick}
        />
      )}
      <Kb.Divider />
      <SettingsItem
        text="About"
        testID={TestIDs.SETTINGS_ROW_ABOUT}
        type={Settings.settingsAboutTab}
        selected={props.selected === Settings.settingsAboutTab}
        onClick={props.onClick}
      />
      {/* TODO: Do something with logoutInProgress once Offline is
      removed from the settings page. */}
      <SettingsItem text="Sign out" selected={false} type={'nope'} onClick={() => navigate(Settings.settingsLogOutTab)} />
    </Kb.ScrollView>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  container: Kb.Styles.platformStyles({
    common: {
      backgroundColor: theme.blueGrey,
      flexDirection: 'column',
    },
    isElectron: {
      height: '100%',
      paddingTop: Kb.Styles.globalMargins.small,
    },
  }),
}))

export default LeftNav
