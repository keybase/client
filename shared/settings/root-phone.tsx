import * as C from '../constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '../constants/types'
import type {Section as _Section} from '@/common-adapters/section-list'
import {keybaseFM} from '../constants/whats-new'
import {isAndroid} from '../constants/platform'
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
  const onTabChange = React.useCallback(
    (s: any) => {
      navigateAppend(s)
    },
    [navigateAppend]
  )
  const contactsLabel = C.useSettingsContactsState(s =>
    s.importEnabled ? 'Phone contacts' : 'Import phone contacts'
  )

  const sections: Array<Section> = [
    {
      data: [
        ...(statsShown ? [{onClick: noop, text: 'perf'}] : []),
        {
          icon: 'iconfont-nav-2-crypto',
          onClick: () => onTabChange(C.settingsCryptoTab),
          text: 'Crypto',
        },
        {
          badgeNumber: badgeNumbers.get(C.gitTab),
          icon: 'iconfont-nav-2-git',
          onClick: () => onTabChange(C.settingsGitTab),
          text: 'Git',
        },
        {
          badgeNumber: badgeNumbers.get(C.devicesTab),
          icon: 'iconfont-nav-2-devices',
          onClick: () => onTabChange(C.settingsDevicesTab),
          text: 'Devices',
        },
        {
          badgeNumber: badgeNumbers.get(C.walletsTab),
          icon: 'iconfont-nav-2-wallets',
          onClick: () => onTabChange(C.settingsWalletsTab),
          text: 'Wallet',
        },
        {
          iconComponent: WhatsNewIcon,
          onClick: () => onTabChange(C.settingsWhatsNewTab),
          subText: `What's new?`,
          text: keybaseFM,
        },
      ],
      title: '',
    },
    {
      data: [
        {
          badgeNumber: badgeNumbers.get(C.settingsTab),
          onClick: () => onTabChange(C.settingsAccountTab),
          text: 'Your account',
        },
        {
          onClick: () => onTabChange(C.settingsChatTab),
          text: 'Chat',
        },
        {
          onClick: () => onTabChange(C.settingsContactsTab),
          text: contactsLabel,
        },
        {
          onClick: () => onTabChange(C.settingsFsTab),
          text: 'Files',
        },
        {
          badgeNumber: badgeNotifications ? 1 : 0,
          onClick: () => onTabChange(C.settingsNotificationsTab),
          text: 'Notifications',
        },
        {
          onClick: () => onTabChange(C.settingsDisplayTab),
          text: 'Display',
        },
        ...(isAndroid
          ? [
              {
                onClick: () => onTabChange(C.settingsScreenprotectorTab),
                text: 'Screen protector',
              } as const,
            ]
          : []),
      ] as const,
      title: 'Settings' as const,
    },
    {
      data: [
        {onClick: () => onTabChange(C.settingsAboutTab), text: 'About'},
        {onClick: () => onTabChange(C.settingsFeedbackTab), text: 'Feedback'},
        {onClick: () => onTabChange(C.settingsAdvancedTab), text: 'Advanced'},
        {
          onClick: () => onTabChange(C.settingsLogOutTab),
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
