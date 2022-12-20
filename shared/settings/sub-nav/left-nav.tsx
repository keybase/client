import * as Constants from '../../constants/settings'
import * as Container from '../../util/container'
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
  const badgeNumbers = Container.useSelector(state => state.notifications.navBadges)
  const badgeNotifications = Container.useSelector(state => !state.push.hasPermissions)
  return (
    <Kb.ScrollView style={styles.container}>
      {Styles.isTablet && (
        <>
          <SettingsItem
            icon="iconfont-nav-2-crypto"
            text="Crypto"
            selected={props.selected === Constants.cryptoTab}
            onClick={() => props.onClick(Constants.cryptoTab)}
            badgeNumber={badgeNumbers.get(TabConstants.cryptoTab)}
          />
          <SettingsItem
            icon="iconfont-nav-2-git"
            text="Git"
            selected={props.selected === Constants.gitTab}
            onClick={() => props.onClick(Constants.gitTab)}
            badgeNumber={badgeNumbers.get(TabConstants.gitTab)}
          />
          <SettingsItem
            text="Devices"
            icon="iconfont-nav-2-devices"
            selected={props.selected === Constants.devicesTab}
            onClick={() => props.onClick(Constants.devicesTab)}
            badgeNumber={badgeNumbers.get(TabConstants.devicesTab)}
          />

          <SettingsItem
            text={keybaseFM}
            iconComponent={WhatsNewIcon as any}
            selected={props.selected === Constants.whatsNewTab}
            onClick={() => props.onClick(Constants.whatsNewTab)}
          />
          <Kb.SectionDivider label="Settings" />
        </>
      )}
      <SettingsItem
        text="Your account"
        selected={props.selected === Constants.accountTab}
        onClick={() => props.onClick(Constants.accountTab)}
        badgeNumber={badgeNumbers.get(TabConstants.settingsTab)}
      />
      <SettingsItem
        text="Chat"
        selected={props.selected === Constants.chatTab}
        onClick={() => props.onClick(Constants.chatTab)}
      />
      {Styles.isTablet && props.contactsLabel && (
        <SettingsItem
          text={props.contactsLabel}
          selected={props.selected === Constants.contactsTab}
          onClick={() => props.onClick(Constants.contactsTab)}
        />
      )}
      <SettingsItem
        text="Files"
        selected={props.selected === Constants.fsTab}
        onClick={() => props.onClick(Constants.fsTab)}
      />
      <SettingsItem
        badgeNumber={badgeNotifications ? 1 : 0}
        text="Notifications"
        selected={props.selected === Constants.notificationsTab}
        onClick={() => props.onClick(Constants.notificationsTab)}
      />
      <SettingsItem
        text="Display"
        selected={props.selected === Constants.displayTab}
        onClick={() => props.onClick(Constants.displayTab)}
      />
      {Styles.isTablet && (
        <SettingsItem
          text="About"
          selected={props.selected === Constants.aboutTab}
          onClick={() => props.onClick(Constants.aboutTab)}
        />
      )}
      <SettingsItem
        text="Feedback"
        selected={props.selected === Constants.feedbackTab}
        onClick={() => props.onClick(Constants.feedbackTab)}
      />
      {!Styles.isTablet && (
        <SettingsItem
          text="Invitations"
          selected={props.selected === Constants.invitationsTab}
          onClick={() => props.onClick(Constants.invitationsTab)}
        />
      )}
      <SettingsItem
        text="Advanced"
        selected={props.selected === Constants.advancedTab}
        onClick={() => props.onClick(Constants.advancedTab)}
      />
      {/* TODO: Do something with logoutInProgress once Offline is
        removed from the settings page. */}
      <SettingsItem
        text="Sign out"
        selected={false}
        onClick={() => {
          props.navigate(Constants.logOutTab)
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
