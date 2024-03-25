import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type {Section as _Section} from '@/common-adapters/section-list'
import {keybaseFM} from '@/constants/whats-new'
import {isAndroid} from '@/constants/platform'
import SettingsItem from './sub-nav/settings-item'
import WhatsNewIcon from '../whats-new/icon/container'
import noop from 'lodash/noop'

const PerfRow = () => {
  const [toSubmit, setToSubmit] = React.useState('')
  const ref = React.useRef<Kb.PlainInput>(null)

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
          ref.current?.transformText(
            () => ({
              selection: {end: 0, start: 0},
              text: '',
            }),
            true
          )
        }}
      />
      <Kb.PlainInput
        ref={ref}
        onChangeText={text => setToSubmit(`GUI: ${text}`)}
        style={styles.perfInput}
        placeholder="Add to perf log"
      />
    </Kb.Box2>
  )
}

type Section = _Section<
  {
    badgeNumber?: number
    text: string
    icon?: Kb.IconType
    onClick: () => void
    iconComponent?: (a: {}) => React.ReactElement
    subText?: string
    textColor?: string
  },
  {title: string}
>

function SettingsNav() {
  const badgeNumbers = C.useNotifState(s => s.navBadges)
  const badgeNotifications = C.usePushState(s => !s.hasPermissions)
  const statsShown = C.useConfigState(s => !!s.runtimeStats)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const contactsLabel = C.useSettingsContactsState(s =>
    s.importEnabled ? 'Phone contacts' : 'Import phone contacts'
  )

  const sections: Array<Section> = [
    {
      data: [
        ...(statsShown ? [{onClick: noop, text: 'perf'}] : []),
        {
          icon: 'iconfont-nav-2-crypto',
          onClick: () => {
            navigateAppend(C.Settings.settingsCryptoTab)
          },
          text: 'Crypto',
        },
        {
          badgeNumber: badgeNumbers.get(C.Tabs.gitTab),
          icon: 'iconfont-nav-2-git',
          onClick: () => {
            navigateAppend(C.Settings.settingsGitTab)
          },
          text: 'Git',
        },
        {
          badgeNumber: badgeNumbers.get(C.Tabs.devicesTab),
          icon: 'iconfont-nav-2-devices',
          onClick: () => {
            navigateAppend(C.Settings.settingsDevicesTab)
          },
          text: 'Devices',
        },
        {
          icon: 'iconfont-nav-2-wallets',
          onClick: () => {
            navigateAppend(C.Settings.settingsWalletsTab)
          },
          text: 'Wallet',
        },
        {
          iconComponent: WhatsNewIcon,
          onClick: () => {
            navigateAppend(C.Settings.settingsWhatsNewTab)
          },
          subText: `What's new?`,
          text: keybaseFM,
        },
      ],
      title: '',
    },
    {
      data: [
        {
          badgeNumber: badgeNumbers.get(C.Tabs.settingsTab),
          onClick: () => {
            navigateAppend(C.Settings.settingsAccountTab)
          },
          text: 'Your account',
        },
        {
          onClick: () => {
            navigateAppend(C.Settings.settingsChatTab)
          },
          text: 'Chat',
        },
        {
          onClick: () => {
            navigateAppend(C.Settings.settingsContactsTab)
          },
          text: contactsLabel,
        },
        {
          onClick: () => {
            navigateAppend(C.Settings.settingsFsTab)
          },
          text: 'Files',
        },
        {
          badgeNumber: badgeNotifications ? 1 : 0,
          onClick: () => {
            navigateAppend(C.Settings.settingsNotificationsTab)
          },
          text: 'Notifications',
        },
        {
          onClick: () => {
            navigateAppend(C.Settings.settingsDisplayTab)
          },
          text: 'Display',
        },
        ...(isAndroid
          ? [
              {
                onClick: () => {
                  navigateAppend(C.Settings.settingsScreenprotectorTab)
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
            navigateAppend(C.Settings.settingsAboutTab)
          },
          text: 'About',
        },
        {
          onClick: () => {
            navigateAppend(C.Settings.settingsFeedbackTab)
          },
          text: 'Feedback',
        },
        {
          onClick: () => {
            navigateAppend(C.Settings.settingsAdvancedTab)
          },
          text: 'Advanced',
        },
        {
          onClick: () => {
            navigateAppend(C.Settings.settingsArchiveTab)
          },
          text: 'Archive',
        },
        {
          onClick: () => {
            navigateAppend(C.Settings.settingsLogOutTab)
          },
          text: 'Sign out',
          textColor: Kb.Styles.globalColors.red,
        },
      ] as const,
      title: 'More' as const,
    },
  ]

  return (
    <Kb.SectionList
      keyboardShouldPersistTaps="handled"
      keyExtractor={(item, index) => item.text + index}
      initialNumToRender={20}
      renderItem={({item}) => {
        if (item.text === 'perf') {
          return <PerfRow />
        }
        return item.text ? <SettingsItem {...item} /> : null
      }}
      renderSectionHeader={({section: {title}}) =>
        title ? (
          <Kb.Text type="BodySmallSemibold" style={styles.sectionTitle}>
            {title}
          </Kb.Text>
        ) : null
      }
      style={Kb.Styles.globalStyles.fullHeight}
      sections={sections}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  perfInput: {backgroundColor: Kb.Styles.globalColors.grey},
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
