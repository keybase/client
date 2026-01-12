import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import WhatsNewIcon from '@/whats-new/icon'
import SettingsItem from './settings-item'
import {keybaseFM} from '@/stores/whats-new'
import * as Settings from '@/stores/settings'
import {usePushState} from '@/stores/push'
import {useNotifState} from '@/stores/notifications'

type Props = {
  onClick: (s: string) => void
  navigate: (s: string) => void
  selected: string
  contactsLabel?: string
}

const LeftNav = (props: Props) => {
  const {navigate} = props
  const badgeNumbers = useNotifState(s => s.navBadges)
  const badgeNotifications = usePushState(s => (C.isElectron ? 0 : !s.hasPermissions ? 1 : 0))

  const onSignout = React.useCallback(() => {
    navigate(Settings.settingsLogOutTab)
  }, [navigate])
  return (
    <Kb.Styles.CanFixOverdrawContext.Provider value={false}>
      <Kb.ScrollView style={styles.container}>
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

            <SettingsItem
              text={keybaseFM}
              iconComponent={WhatsNewIcon}
              type={Settings.settingsWhatsNewTab}
              selected={props.selected === Settings.settingsWhatsNewTab}
              onClick={props.onClick}
            />
            <Kb.SectionDivider label="Settings" />
          </>
        )}
        <SettingsItem
          text="Account"
          selected={props.selected === Settings.settingsAccountTab}
          type={Settings.settingsAccountTab}
          onClick={props.onClick}
          badgeNumber={badgeNumbers.get(C.Tabs.settingsTab)}
        />
        <SettingsItem
          text="Advanced"
          type={Settings.settingsAdvancedTab}
          selected={props.selected === Settings.settingsAdvancedTab}
          onClick={props.onClick}
        />
        <SettingsItem
          text="Backup"
          type={Settings.settingsArchiveTab}
          selected={props.selected === Settings.settingsArchiveTab}
          onClick={props.onClick}
        />
        <SettingsItem
          text="Chat"
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
          type={Settings.settingsDisplayTab}
          selected={props.selected === Settings.settingsDisplayTab}
          onClick={props.onClick}
        />
        <SettingsItem
          text="Feedback"
          type={Settings.settingsFeedbackTab}
          selected={props.selected === Settings.settingsFeedbackTab}
          onClick={props.onClick}
        />
        <SettingsItem
          text="Files"
          type={Settings.settingsFsTab}
          selected={props.selected === Settings.settingsFsTab}
          onClick={props.onClick}
        />
        {!Kb.Styles.isTablet && (
          <SettingsItem
            text="Invitations"
            type={Settings.settingsInvitationsTab}
            selected={props.selected === Settings.settingsInvitationsTab}
            onClick={props.onClick}
          />
        )}
        <SettingsItem
          badgeNumber={badgeNotifications}
          text="Notifications"
          type={Settings.settingsNotificationsTab}
          selected={props.selected === Settings.settingsNotificationsTab}
          onClick={props.onClick}
        />

        {!Kb.Styles.isTablet && (
          <SettingsItem
            text="Screen protector"
            type={Settings.settingsScreenprotectorTab}
            selected={props.selected === Settings.settingsScreenprotectorTab}
            onClick={props.onClick}
          />
        )}
        <SettingsItem
          text="Wallet"
          type={Settings.settingsWalletsTab}
          selected={props.selected === Settings.settingsWalletsTab}
          onClick={props.onClick}
        />
        <Kb.Divider />
        <SettingsItem
          text="About"
          type={Settings.settingsAboutTab}
          selected={props.selected === Settings.settingsAboutTab}
          onClick={props.onClick}
        />
        {/* TODO: Do something with logoutInProgress once Offline is
        removed from the settings page. */}
        <SettingsItem text="Sign out" selected={false} type={'nope'} onClick={onSignout} />
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
