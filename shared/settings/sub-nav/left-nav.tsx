import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as TabConstants from '@/constants/tabs'
import WhatsNewIcon from '@/whats-new/icon'
import SettingsItem from './settings-item'
import {keybaseFM} from '@/constants/whats-new'

type Props = {
  onClick: (s: string) => void
  navigate: (s: string) => void
  selected: string
  contactsLabel?: string
}

const LeftNav = (props: Props) => {
  const {navigate} = props
  const badgeNumbers = C.useNotifState(s => s.navBadges)
  const badgeNotifications = C.usePushState(s => (C.isElectron ? 0 : !s.hasPermissions ? 1 : 0))

  const onSignout = React.useCallback(() => {
    navigate(C.Settings.settingsLogOutTab)
  }, [navigate])
  return (
    <Kb.Styles.CanFixOverdrawContext.Provider value={false}>
      <Kb.ScrollView style={styles.container}>
        {Kb.Styles.isTablet && (
          <>
            <SettingsItem
              icon="iconfont-nav-2-crypto"
              text="Crypto"
              type={C.Settings.settingsCryptoTab}
              selected={props.selected === C.Settings.settingsCryptoTab}
              onClick={props.onClick}
              badgeNumber={badgeNumbers.get(TabConstants.cryptoTab)}
            />
            <SettingsItem
              icon="iconfont-nav-2-git"
              text="Git"
              type={C.Settings.settingsGitTab}
              selected={props.selected === C.Settings.settingsGitTab}
              onClick={props.onClick}
              badgeNumber={badgeNumbers.get(TabConstants.gitTab)}
            />
            <SettingsItem
              text="Devices"
              icon="iconfont-nav-2-devices"
              type={C.Settings.settingsDevicesTab}
              selected={props.selected === C.Settings.settingsDevicesTab}
              onClick={props.onClick}
              badgeNumber={badgeNumbers.get(TabConstants.devicesTab)}
            />

            <SettingsItem
              text={keybaseFM}
              iconComponent={WhatsNewIcon}
              type={C.Settings.settingsWhatsNewTab}
              selected={props.selected === C.Settings.settingsWhatsNewTab}
              onClick={props.onClick}
            />
            <Kb.SectionDivider label="Settings" />
          </>
        )}
        <SettingsItem
          text="Account"
          selected={props.selected === C.Settings.settingsAccountTab}
          type={C.Settings.settingsAccountTab}
          onClick={props.onClick}
          badgeNumber={badgeNumbers.get(TabConstants.settingsTab)}
        />
        <SettingsItem
          text="Advanced"
          type={C.Settings.settingsAdvancedTab}
          selected={props.selected === C.Settings.settingsAdvancedTab}
          onClick={props.onClick}
        />
        <SettingsItem
          text="Backup"
          type={C.Settings.settingsArchiveTab}
          selected={props.selected === C.Settings.settingsArchiveTab}
          onClick={props.onClick}
        />
        <SettingsItem
          text="Chat"
          type={C.Settings.settingsChatTab}
          selected={props.selected === C.Settings.settingsChatTab}
          onClick={props.onClick}
        />
        {Kb.Styles.isTablet && props.contactsLabel && (
          <SettingsItem
            text={props.contactsLabel}
            type={C.Settings.settingsContactsTab}
            selected={props.selected === C.Settings.settingsContactsTab}
            onClick={props.onClick}
          />
        )}
        <SettingsItem
          text="Display"
          type={C.Settings.settingsDisplayTab}
          selected={props.selected === C.Settings.settingsDisplayTab}
          onClick={props.onClick}
        />
        <SettingsItem
          text="Feedback"
          type={C.Settings.settingsFeedbackTab}
          selected={props.selected === C.Settings.settingsFeedbackTab}
          onClick={props.onClick}
        />
        <SettingsItem
          text="Files"
          type={C.Settings.settingsFsTab}
          selected={props.selected === C.Settings.settingsFsTab}
          onClick={props.onClick}
        />
        {!Kb.Styles.isTablet && (
          <SettingsItem
            text="Invitations"
            type={C.Settings.settingsInvitationsTab}
            selected={props.selected === C.Settings.settingsInvitationsTab}
            onClick={props.onClick}
          />
        )}
        <SettingsItem
          badgeNumber={badgeNotifications}
          text="Notifications"
          type={C.Settings.settingsNotificationsTab}
          selected={props.selected === C.Settings.settingsNotificationsTab}
          onClick={props.onClick}
        />

        {!Kb.Styles.isTablet && (
          <SettingsItem
            text="Screen protector"
            type={C.Settings.settingsScreenprotectorTab}
            selected={props.selected === C.Settings.settingsScreenprotectorTab}
            onClick={props.onClick}
          />
        )}
        <SettingsItem
          text="Wallet"
          type={C.Settings.settingsWalletsTab}
          selected={props.selected === C.Settings.settingsWalletsTab}
          onClick={props.onClick}
        />
        <Kb.Divider />
        <SettingsItem
          text="About"
          type={C.Settings.settingsAboutTab}
          selected={props.selected === C.Settings.settingsAboutTab}
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
