import * as C from '@/constants'
import {useIsChatSplit} from '@/constants/chat/layout'
import * as React from 'react'
import {useNavigation} from '@react-navigation/native'
import * as Kb from '@/common-adapters'
import SettingsItem from './sub-nav/settings-item'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import * as Settings from '@/constants/settings'
import {usePushState} from '@/stores/push'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {useNotifState} from '@/stores/notifications'

type Item = {
  badgeNumber?: number
  text: string
  icon?: Kb.IconType
  onClick: () => void
  iconComponent?: (a: object) => React.ReactElement
  subText?: string
  testID?: string
  textColor?: string
}
type Section = {title: string; data: ReadonlyArray<Item>}

function SettingsNav() {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  // Narrow to the three tabs shown here so chat/team badge churn doesn't re-render settings
  const badgeNumbers = useNotifState(
    C.useShallow(s => ({
      devices: s.navBadges.get(C.Tabs.devicesTab),
      git: s.navBadges.get(C.Tabs.gitTab),
      settings: s.navBadges.get(C.Tabs.settingsTab),
    }))
  )
  const badgeNotifications = usePushState(s => !s.hasPermissions)
  const navigateAppend = C.Router2.navigateAppend
  const contactsLabel = useSettingsContactsState(s =>
    s.importEnabled ? 'Phone contacts' : 'Import phone contacts'
  )

  const sections: Array<Section> = [
    {
      data: [
        {
          icon: 'iconfont-nav-2-crypto',
          onClick: () => {
            navigateAppend({name: Settings.settingsCryptoTab, params: {}})
          },
          text: 'Crypto',
        },
        {
          badgeNumber: badgeNumbers.devices,
          icon: 'iconfont-nav-2-devices',
          onClick: () => {
            navigateAppend({name: Settings.settingsDevicesTab, params: {}})
          },
          text: 'Devices',
        },
        {
          badgeNumber: badgeNumbers.git,
          icon: 'iconfont-nav-2-git',
          onClick: () => {
            navigateAppend({name: Settings.settingsGitTab, params: {}})
          },
          text: 'Git',
        },
        {
          icon: 'iconfont-nav-2-wallets',
          onClick: () => {
            navigateAppend({name: Settings.settingsWalletsTab, params: {}})
          },
          text: 'Wallet',
        },
      ],
      title: '',
    },
    {
      data: [
        {
          badgeNumber: badgeNumbers.settings,
          onClick: () => {
            navigateAppend({name: Settings.settingsAccountTab, params: {}})
          },
          text: 'Account',
        },
        {
          onClick: () => {
            navigateAppend({name: Settings.settingsAdvancedTab, params: {}})
          },
          text: 'Advanced',
        },
        {
          onClick: () => {
            navigateAppend({name: Settings.settingsArchiveTab, params: {}})
          },
          text: 'Backup',
        },
        {
          onClick: () => {
            navigateAppend({name: Settings.settingsChatTab, params: {}})
          },
          testID: TestIDs.SETTINGS_ROW_CHAT,
          text: 'Chat',
        },
        {
          onClick: () => {
            navigateAppend({name: Settings.settingsDisplayTab, params: {}})
          },
          text: 'Display',
        },
        {
          onClick: () => {
            navigateAppend({name: Settings.settingsFeedbackTab, params: {}})
          },
          text: 'Feedback',
        },
        {
          onClick: () => {
            navigateAppend({name: Settings.settingsFsTab, params: {}})
          },
          testID: TestIDs.SETTINGS_ROW_FILES,
          text: 'Files',
        },
        {
          onClick: () => {
            navigateAppend({name: Settings.settingsContactsTab, params: {}})
          },
          testID: TestIDs.SETTINGS_ROW_CONTACTS,
          text: contactsLabel,
        },
        {
          badgeNumber: badgeNotifications ? 1 : 0,
          onClick: () => {
            navigateAppend({name: Settings.settingsNotificationsTab, params: {}})
          },
          text: 'Notifications',
        },
        ...(isAndroid
          ? [
              {
                onClick: () => {
                  navigateAppend({name: Settings.settingsScreenprotectorTab, params: {}})
                },
                text: 'Screen protector',
              } as const,
            ]
          : []),
      ] as const,
      title: 'Settings' as const,
    },
    {
      data: [
        {
          onClick: () => {
            navigateAppend({name: Settings.settingsAboutTab, params: {}})
          },
          text: 'About',
        },
        ...(__DEV__
          ? [
              {
                onClick: () => {
                  navigateAppend({name: Settings.settingsTypographyTab, params: {}})
                },
                text: 'Typography',
              } as const,
              {
                onClick: () => {
                  navigateAppend({name: Settings.settingsIconsTab, params: {}})
                },
                text: 'Icons',
              } as const,
              {
                onClick: () => {
                  navigateAppend({name: Settings.settingsMarkdownTab, params: {}})
                },
                text: 'Markdown',
              } as const,
            ]
          : []),
        {
          onClick: () => {
            navigateAppend({name: Settings.settingsLogOutTab, params: {}})
          },
          text: 'Sign out',
          textColor: theme.red,
        },
      ] as const,
      title: 'More' as const,
    },
  ]

  return (
    <Kb.ScrollView style={Kb.Styles.globalStyles.fullHeight} testID={TestIDs.SETTINGS_ACCOUNT}>
      {sections.map(section => (
        <React.Fragment key={section.title || '_top'}>
          {section.title ? (
            <Kb.Text type="BodySmallSemibold" style={styles.sectionTitle}>
              {section.title}
            </Kb.Text>
          ) : null}
          {section.data.map((item, index) =>
            item.text ? (
              <SettingsItem
                {...item}
                key={item.text + String(index)}
                type={item.text}
                onClick={() => item.onClick()}
                selected={false}
              />
            ) : null
          )}
        </React.Fragment>
      ))}
    </Kb.ScrollView>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  sectionTitle: {
    backgroundColor: theme.blueLighter3,
    color: theme.black_50,
    ...Kb.Styles.padding(7, Kb.Styles.globalMargins.small),
  },
}))

// An iPhone Duo unfolded to its whole inner screen shows settings like an iPad: the list beside the
// selected page. It splits at the same window width as chat.
const SettingsSplit = React.lazy(async () => import('./root-desktop-tablet'))

function SettingsRoot() {
  const split = useIsChatSplit()
  const navigation = useNavigation()
  // the split hides the tab's bar for its own column bars; the list alone uses the tab's bar
  React.useLayoutEffect(() => {
    if (!split) navigation.setOptions({headerShown: true})
  }, [navigation, split])
  return split ? <SettingsSplit /> : <SettingsNav />
}

export default SettingsRoot
