import * as React from 'react'
import * as TabConstants from '../constants/tabs'
import * as Kb from '../common-adapters/mobile.native'
import * as Constants from '../constants/settings'
import * as Container from '../util/container'
import * as Styles from '../styles'
import {logPerfLogPointRpcPromise} from '../constants/types/rpc-gen'
import {keybaseFM} from '../constants/whats-new'
import {isAndroid} from '../constants/platform'
import SettingsItem from './sub-nav/settings-item'
import WhatsNewIcon from '../whats-new/icon/container'
import noop from 'lodash/noop'

type Props = {navigation: any}

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

const renderItem = ({item}) => {
  if (item.text === 'perf') {
    return <PerfRow />
  }
  return item.text ? <SettingsItem {...item} /> : null
}

function SettingsNav(props: Props) {
  const badgeNumbers = Container.useSelector(state => state.notifications.navBadges)
  const badgeNotifications = Container.useSelector(state => !state.push.hasPermissions)
  const statsShown = Container.useSelector(state => !!state.config.runtimeStats)
  const {navigation} = props
  const onTabChange = React.useCallback(s => navigation.navigate(s), [navigation])
  const contactsLabel = Container.useSelector(state =>
    state.settings.contacts.importEnabled ? 'Phone contacts' : 'Import phone contacts'
  )

  return (
    <Kb.NativeSectionList
      overScrollMode="never"
      onScrollToIndexFailed={noop}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(item, index) => item.text + index}
      initialNumToRender={20}
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
                onClick: () => onTabChange(Constants.cryptoTab),
                text: 'Crypto',
              },
              {
                badgeNumber: badgeNumbers.get(TabConstants.gitTab),
                icon: 'iconfont-nav-2-git',
                onClick: () => onTabChange(Constants.gitTab),
                text: 'Git',
              },
              {
                badgeNumber: badgeNumbers.get(TabConstants.devicesTab),
                icon: 'iconfont-nav-2-devices',
                onClick: () => onTabChange(Constants.devicesTab),
                text: 'Devices',
              },
              {
                badgeNumber: badgeNumbers.get(TabConstants.walletsTab),
                icon: 'iconfont-nav-2-wallets',
                onClick: () => onTabChange(Constants.walletsTab),
                text: 'Wallet',
              },
              {
                iconComponent: WhatsNewIcon,
                onClick: () => onTabChange(Constants.whatsNewTab),
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
                onClick: () => onTabChange(Constants.accountTab),
                text: 'Your account',
              },
              {
                onClick: () => onTabChange(Constants.chatTab),
                text: 'Chat',
              },
              {
                onClick: () => onTabChange(Constants.contactsTab),
                text: contactsLabel,
              },
              {
                onClick: () => onTabChange(Constants.fsTab),
                text: 'Files',
              },
              {
                badgeNumber: badgeNotifications ? 1 : 0,
                onClick: () => onTabChange(Constants.notificationsTab),
                text: 'Notifications',
              },
              {
                onClick: () => onTabChange(Constants.displayTab),
                text: 'Display',
              },
              ...(isAndroid
                ? [
                    {
                      onClick: () => onTabChange(Constants.screenprotectorTab),
                      text: 'Screen protector',
                    },
                  ]
                : []),
            ],
            title: 'Settings',
          },
          {
            data: [
              {onClick: () => onTabChange(Constants.aboutTab), text: 'About'},
              {onClick: () => onTabChange(Constants.feedbackTab), text: 'Feedback'},
              {onClick: () => onTabChange(Constants.advancedTab), text: 'Advanced'},
              {
                onClick: () => onTabChange(Constants.logOutTab),
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
SettingsNav.navigationOptions = {
  title: 'More',
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

export default SettingsNav
