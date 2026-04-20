import * as C from '@/constants'
import {useConfigState} from '@/stores/config'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import SettingsItem from './sub-nav/settings-item'
import noop from 'lodash/noop'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import * as Settings from '@/constants/settings'
import {usePushState} from '@/stores/push'
import {useNotifState} from '@/stores/notifications'

const PerfRow = () => {
  const [toSubmit, setToSubmit] = React.useState('')
  const ref = React.useRef<Kb.Input3Ref>(null)

  return (
    <Kb.Box2
      alignItems="center"
      direction="horizontal"
      fullWidth={true}
      gap="xtiny"
      style={styles.perfRow}
      gapStart={true}
    >
      <Kb.Button
        small={true}
        label="PerfLog"
        onClick={() => {
          T.RPCGen.logPerfLogPointRpcPromise({msg: toSubmit})
            .then(() => {})
            .catch(() => {})
          ref.current?.clear()
        }}
      />
      <Kb.Input3
        ref={ref}
        onChangeText={(text: string) => setToSubmit(`GUI: ${text}`)}
        hideBorder={true}
        containerStyle={styles.perfInput}
        placeholder="Add to perf log"
      />
    </Kb.Box2>
  )
}

type Item = {
  badgeNumber?: number
  text: string
  icon?: Kb.IconType
  onClick: () => void
  iconComponent?: (a: object) => React.ReactElement
  subText?: string
  textColor?: string
}
type Section = {title: string; data: ReadonlyArray<Item>}

function SettingsNav() {
  const badgeNumbers = useNotifState(s => s.navBadges)
  const badgeNotifications = usePushState(s => !s.hasPermissions)
  const statsShown = useConfigState(s => !!s.runtimeStats)
  const navigateAppend = C.Router2.navigateAppend
  const contactsLabel = useSettingsContactsState(s =>
    s.importEnabled ? 'Phone contacts' : 'Import phone contacts'
  )

  const sections: Array<Section> = [
    {
      data: [
        ...(statsShown ? [{onClick: noop, text: 'perf'}] : []),
        {
          icon: 'iconfont-nav-2-crypto',
          onClick: () => {
            navigateAppend({name: Settings.settingsCryptoTab, params: {}})
          },
          text: 'Crypto',
        },
        {
          badgeNumber: badgeNumbers.get(C.Tabs.devicesTab),
          icon: 'iconfont-nav-2-devices',
          onClick: () => {
            navigateAppend({name: Settings.settingsDevicesTab, params: {}})
          },
          text: 'Devices',
        },
        {
          badgeNumber: badgeNumbers.get(C.Tabs.gitTab),
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
          badgeNumber: badgeNumbers.get(C.Tabs.settingsTab),
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
          text: 'Files',
        },
        {
          onClick: () => {
            navigateAppend({name: Settings.settingsContactsTab, params: {}})
          },
          text: contactsLabel,
        },
        {
          badgeNumber: badgeNotifications ? 1 : 0,
          onClick: () => {
            navigateAppend({name: Settings.settingsNotificationsTab, params: {}})
          },
          text: 'Notifications',
        },
        ...(C.isAndroid
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
        {
          onClick: () => {
            navigateAppend({name: Settings.settingsLogOutTab, params: {}})
          },
          text: 'Sign out',
          textColor: Kb.Styles.globalColors.red,
        },
      ] as const,
      title: 'More' as const,
    },
  ]

  return (
    <Kb.ScrollView style={Kb.Styles.globalStyles.fullHeight}>
      {sections.map(section => (
        <React.Fragment key={section.title || '_top'}>
          {section.title ? (
            <Kb.Text type="BodySmallSemibold" style={styles.sectionTitle}>
              {section.title}
            </Kb.Text>
          ) : null}
          {section.data.map((item, index) =>
            item.text === 'perf' ? (
              <PerfRow key="perf" />
            ) : item.text ? (
              <SettingsItem
                {...item}
                key={item.text + index}
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  perfInput: {backgroundColor: Kb.Styles.globalColors.grey, flex: 1, padding: 0, width: 'auto' as const},
  perfRow: {height: 44},
  sectionTitle: {
    backgroundColor: Kb.Styles.globalColors.blueLighter3,
    color: Kb.Styles.globalColors.black_50,
    paddingBottom: 7,
    paddingLeft: Kb.Styles.globalMargins.small,
    paddingRight: Kb.Styles.globalMargins.small,
    paddingTop: 7,
  },
}))

export default SettingsNav
