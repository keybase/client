import * as C from '@/constants'
import {useConfigState} from '@/stores/config'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {keybaseFM} from '@/stores/whats-new'
import SettingsItem from './sub-nav/settings-item'
import WhatsNewIcon from '../whats-new/icon'
import noop from 'lodash/noop'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import * as Settings from '@/stores/settings'
import {usePushState} from '@/stores/push'
import {useNotifState} from '@/stores/notifications'

const PerfRow = () => {
  const [toSubmit, setToSubmit] = React.useState('')
  const ref = React.useRef<Kb.PlainInputRef>(null)

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

type Item = {
  badgeNumber?: number
  text: string
  icon?: Kb.IconType
  onClick: () => void
  iconComponent?: (a: object) => React.ReactElement
  subText?: string
  textColor?: string
}
type Section = Omit<Kb.SectionType<Item>, 'renderItem'>

function SettingsNav() {
  const badgeNumbers = useNotifState(s => s.navBadges)
  const badgeNotifications = usePushState(s => !s.hasPermissions)
  const statsShown = useConfigState(s => !!s.runtimeStats)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
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
            navigateAppend(Settings.settingsCryptoTab)
          },
          text: 'Crypto',
        },
        {
          badgeNumber: badgeNumbers.get(C.Tabs.devicesTab),
          icon: 'iconfont-nav-2-devices',
          onClick: () => {
            navigateAppend(Settings.settingsDevicesTab)
          },
          text: 'Devices',
        },
        {
          badgeNumber: badgeNumbers.get(C.Tabs.gitTab),
          icon: 'iconfont-nav-2-git',
          onClick: () => {
            navigateAppend(Settings.settingsGitTab)
          },
          text: 'Git',
        },
        {
          icon: 'iconfont-nav-2-wallets',
          onClick: () => {
            navigateAppend(Settings.settingsWalletsTab)
          },
          text: 'Wallet',
        },
        {
          iconComponent: WhatsNewIcon,
          onClick: () => {
            navigateAppend(Settings.settingsWhatsNewTab)
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
            navigateAppend(Settings.settingsAccountTab)
          },
          text: 'Account',
        },
        {
          onClick: () => {
            navigateAppend(Settings.settingsAdvancedTab)
          },
          text: 'Advanced',
        },
        {
          onClick: () => {
            navigateAppend(Settings.settingsArchiveTab)
          },
          text: 'Backup',
        },
        {
          onClick: () => {
            navigateAppend(Settings.settingsChatTab)
          },
          text: 'Chat',
        },
        {
          onClick: () => {
            navigateAppend(Settings.settingsDisplayTab)
          },
          text: 'Display',
        },
        {
          onClick: () => {
            navigateAppend(Settings.settingsFeedbackTab)
          },
          text: 'Feedback',
        },
        {
          onClick: () => {
            navigateAppend(Settings.settingsFsTab)
          },
          text: 'Files',
        },
        {
          onClick: () => {
            navigateAppend(Settings.settingsContactsTab)
          },
          text: contactsLabel,
        },
        {
          badgeNumber: badgeNotifications ? 1 : 0,
          onClick: () => {
            navigateAppend(Settings.settingsNotificationsTab)
          },
          text: 'Notifications',
        },
        ...(C.isAndroid
          ? [
              {
                onClick: () => {
                  navigateAppend(Settings.settingsScreenprotectorTab)
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
            navigateAppend(Settings.settingsAboutTab)
          },
          text: 'About',
        },
        {
          onClick: () => {
            navigateAppend(Settings.settingsLogOutTab)
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
        return item.text ? (
          <SettingsItem {...item} type={item.text} onClick={() => item.onClick()} selected={false} />
        ) : null
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
