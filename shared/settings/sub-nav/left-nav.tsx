import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as TabConstants from '@/constants/tabs'
import WhatsNewIcon from '@/whats-new/icon/container'
import SettingsItem from './settings-item'
import {keybaseFM} from '@/constants/whats-new'

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
    <Kb.Styles.CanFixOverdrawContext.Provider value={false}>
      <Kb.ScrollView style={styles.container}>
        {Kb.Styles.isTablet && (
          <>
            <SettingsItem
              icon="iconfont-nav-2-crypto"
              text="Crypto"
              selected={props.selected === C.Settings.settingsCryptoTab}
              onClick={() => props.onClick(C.Settings.settingsCryptoTab)}
              badgeNumber={badgeNumbers.get(TabConstants.cryptoTab)}
            />
            <SettingsItem
              icon="iconfont-nav-2-git"
              text="Git"
              selected={props.selected === C.Settings.settingsGitTab}
              onClick={() => props.onClick(C.Settings.settingsGitTab)}
              badgeNumber={badgeNumbers.get(TabConstants.gitTab)}
            />
            <SettingsItem
              text="Devices"
              icon="iconfont-nav-2-devices"
              selected={props.selected === C.Settings.settingsDevicesTab}
              onClick={() => props.onClick(C.Settings.settingsDevicesTab)}
              badgeNumber={badgeNumbers.get(TabConstants.devicesTab)}
            />

            <SettingsItem
              text={keybaseFM}
              iconComponent={WhatsNewIcon as any}
              selected={props.selected === C.Settings.settingsWhatsNewTab}
              onClick={() => props.onClick(C.Settings.settingsWhatsNewTab)}
            />
            <Kb.SectionDivider label="Settings" />
          </>
        )}
        <SettingsItem
          text="Your account"
          selected={props.selected === C.Settings.settingsAccountTab}
          onClick={() => props.onClick(C.Settings.settingsAccountTab)}
          badgeNumber={badgeNumbers.get(TabConstants.settingsTab)}
        />
        <SettingsItem
          text="Chat"
          selected={props.selected === C.Settings.settingsChatTab}
          onClick={() => props.onClick(C.Settings.settingsChatTab)}
        />
        {Kb.Styles.isTablet && props.contactsLabel && (
          <SettingsItem
            text={props.contactsLabel}
            selected={props.selected === C.Settings.settingsContactsTab}
            onClick={() => props.onClick(C.Settings.settingsContactsTab)}
          />
        )}
        <SettingsItem
          text="Files"
          selected={props.selected === C.Settings.settingsFsTab}
          onClick={() => props.onClick(C.Settings.settingsFsTab)}
        />
        <SettingsItem
          badgeNumber={badgeNotifications ? 1 : 0}
          text="Notifications"
          selected={props.selected === C.Settings.settingsNotificationsTab}
          onClick={() => props.onClick(C.Settings.settingsNotificationsTab)}
        />
        <SettingsItem
          text="Display"
          selected={props.selected === C.Settings.settingsDisplayTab}
          onClick={() => props.onClick(C.Settings.settingsDisplayTab)}
        />
        <SettingsItem
          text="About"
          selected={props.selected === C.Settings.settingsAboutTab}
          onClick={() => props.onClick(C.Settings.settingsAboutTab)}
        />

        {!Kb.Styles.isTablet && (
          <SettingsItem
            text="Screen protector"
            selected={props.selected === C.Settings.settingsScreenprotectorTab}
            onClick={() => props.onClick(C.Settings.settingsScreenprotectorTab)}
          />
        )}
        <SettingsItem
          text="Feedback"
          selected={props.selected === C.Settings.settingsFeedbackTab}
          onClick={() => props.onClick(C.Settings.settingsFeedbackTab)}
        />
        {!Kb.Styles.isTablet && (
          <SettingsItem
            text="Invitations"
            selected={props.selected === C.Settings.settingsInvitationsTab}
            onClick={() => props.onClick(C.Settings.settingsInvitationsTab)}
          />
        )}
        <SettingsItem
          text="Advanced"
          selected={props.selected === C.Settings.settingsAdvancedTab}
          onClick={() => props.onClick(C.Settings.settingsAdvancedTab)}
        />
        {C.featureFlags.archive ? (
          <SettingsItem
            text="Archive"
            selected={props.selected === C.Settings.settingsArchiveTab}
            onClick={() => props.onClick(C.Settings.settingsArchiveTab)}
          />
        ) : null}
        <SettingsItem
          text="Wallet"
          selected={props.selected === C.Settings.settingsWalletsTab}
          onClick={() => props.onClick(C.Settings.settingsWalletsTab)}
        />
        {/* TODO: Do something with logoutInProgress once Offline is
        removed from the settings page. */}
        <SettingsItem
          text="Sign out"
          selected={false}
          onClick={() => {
            props.navigate(C.Settings.settingsLogOutTab)
          }}
        />
      </Kb.ScrollView>
    </Kb.Styles.CanFixOverdrawContext.Provider>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      backgroundColor: Kb.Styles.globalColors.blueGrey,
    },
    isElectron: {
      height: '100%',
      paddingTop: Kb.Styles.globalMargins.small,
    },
  }),
}))

export default LeftNav
