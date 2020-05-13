import * as React from 'react'
import * as TabConstants from '../../constants/tabs'
import * as Kb from '../../common-adapters/mobile.native'
import * as Constants from '../../constants/settings'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import {logPerfLogPointRpcPromise} from '../../constants/types/rpc-gen'
import {keybaseFM} from '../../constants/whats-new'
import {isAndroid} from '../../constants/platform'
import SettingsItem from './settings-item'
import WhatsNewIcon from '../../whats-new/icon/container'
import SplitNav from './split-nav'
import noop from 'lodash/noop'

type Props = {
  badgeNotifications?: boolean
  badgeNumbers: Map<TabConstants.Tab, number>
  contactsLabel: string
  hasRandomPW: boolean | null
  logoutInProgress: boolean
  onLogout: () => void
  onTabChange: (tab: Constants.SettingsTab) => void
  selectedTab: Constants.SettingsTab
}

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
          logPerfLogPointRpcPromise({msg: toSubmit})
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

const renderItem = ({item}) => {
  if (item.text === 'perf') {
    return <PerfRow />
  }
  return item.text ? <SettingsItem {...item} /> : null
}

function SettingsNav(props: Props) {
  const {badgeNumbers} = props
  const statsShown = Container.useSelector(state => !!state.config.runtimeStats)

  return (
    <Kb.NativeSectionList
      onScrollToIndexFailed={noop}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(item, index) => item.text + index}
      renderItem={renderItem}
      renderSectionHeader={({section: {title}}) =>
        title ? (
          <Kb.Text type="BodySmallSemibold" style={styles.sectionTitle}>
            {title}
          </Kb.Text>
        ) : null
      }
      style={Styles.globalStyles.fullHeight}
      sections={
        [
          {
            data: [
              ...(statsShown ? [{text: 'perf'}] : []),
              {
                icon: 'iconfont-nav-2-crypto',
                onClick: () => props.onTabChange(Constants.cryptoTab),
                text: 'Crypto',
              },
              {
                badgeNumber: badgeNumbers.get(TabConstants.gitTab),
                icon: 'iconfont-nav-2-git',
                onClick: () => props.onTabChange(Constants.gitTab),
                text: 'Git',
              },
              {
                badgeNumber: badgeNumbers.get(TabConstants.devicesTab),
                icon: 'iconfont-nav-2-devices',
                onClick: () => props.onTabChange(Constants.devicesTab),
                text: 'Devices',
              },
              {
                badgeNumber: badgeNumbers.get(TabConstants.walletsTab),
                icon: 'iconfont-nav-2-wallets',
                onClick: () => props.onTabChange(Constants.walletsTab),
                text: 'Wallet',
              },
              {
                iconComponent: WhatsNewIcon,
                onClick: () => props.onTabChange(Constants.whatsNewTab),
                subText: `What's new?`,
                text: keybaseFM,
              },
            ] as const,
            title: '',
          },
          {
            data: [
              {
                badgeNumber: badgeNumbers.get(TabConstants.settingsTab),
                onClick: () => props.onTabChange(Constants.accountTab),
                text: 'Your account',
              },
              {
                onClick: () => props.onTabChange(Constants.chatTab),
                text: 'Chat',
              },
              {
                onClick: () => props.onTabChange(Constants.contactsTab),
                text: props.contactsLabel,
              },
              {
                onClick: () => props.onTabChange(Constants.fsTab),
                text: 'Files',
              },
              {
                badgeNumber: props.badgeNotifications ? 1 : 0,
                onClick: () => props.onTabChange(Constants.notificationsTab),
                text: 'Notifications',
              },
              {
                onClick: () => props.onTabChange(Constants.displayTab),
                text: 'Display',
              },
              ...(isAndroid
                ? [
                    {
                      onClick: () => props.onTabChange(Constants.screenprotectorTab),
                      text: 'Screen protector',
                    },
                  ]
                : []),
            ],
            title: 'Settings',
          },
          {
            data: [
              {onClick: () => props.onTabChange(Constants.aboutTab), text: 'About'},
              {onClick: () => props.onTabChange(Constants.feedbackTab), text: 'Feedback'},
              {onClick: () => props.onTabChange(Constants.advancedTab), text: 'Advanced'},
              {
                onClick: () => props.onTabChange(Constants.logOutTab),
                text: 'Sign out',
                textColor: Styles.globalColors.red,
              },
            ] as const,
            title: 'More',
          },
        ] as any
      }
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  perfInput: {backgroundColor: Styles.globalColors.grey},
  perfRow: {height: 44},
  sectionTitle: {
    backgroundColor: Styles.globalColors.blueLighter3,
    color: Styles.globalColors.black_50,
    paddingBottom: 7,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: 7,
  },
}))

export default Styles.isPhone ? SettingsNav : SplitNav
