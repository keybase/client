import * as React from 'react'
import * as TabConstants from '../../constants/tabs'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/settings'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import {logPerfLogPointRpcPromise} from '../../constants/types/rpc-gen'
import {keybaseFM} from '../../constants/whats-new'
import {isAndroid} from '../../constants/platform'
import SettingsItem from './settings-item'
import WhatsNewIcon from '../../whats-new/icon/container'
import {Props} from './index'

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

function SettingsNavPhone(props: Props) {
  const {badgeNumbers} = props
  const statsShown = Container.useSelector(state => !!state.config.runtimeStats)

  return (
    <Kb.NativeSectionList
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
      sections={[
        {
          data: [
            ...(statsShown ? [{text: 'perf'}] : []),
            {
              badgeNumber: badgeNumbers.get(TabConstants.gitTab),
              icon: 'iconfont-nav-git',
              onClick: () => props.onTabChange(Constants.gitTab),
              text: 'Git',
            },
            {
              badgeNumber: badgeNumbers.get(TabConstants.devicesTab),
              icon: 'iconfont-nav-devices',
              onClick: () => props.onTabChange(Constants.devicesTab),
              text: 'Devices',
            },
            ...(Styles.isPhone
              ? [
                  {
                    badgeNumber: badgeNumbers.get(TabConstants.walletsTab),
                    icon: 'iconfont-nav-wallets',
                    onClick: () => props.onTabChange(Constants.walletsTab),
                    text: 'Wallet',
                  },
                ]
              : []),
            {
              iconComponent: WhatsNewIcon,
              onClick: () => props.onTabChange(Constants.whatsNewTab),
              subText: `What's new?`,
              text: keybaseFM,
            },
          ],
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
          ],
          title: 'More',
        },
      ]}
    />
  )
}

const SettingsNav = (props: Props) => {
  return (
    <Kb.Box style={styles.container}>
      <SettingsItem
        text="Git"
        selected={props.selectedTab === Constants.gitTab}
        onClick={() => props.onTabChange(Constants.gitTab)}
        badgeNumber={props.badgeNumbers.get(TabConstants.gitTab)}
      />
      <SettingsItem
        text="Devices"
        selected={props.selectedTab === Constants.devicesTab}
        onClick={() => props.onTabChange(Constants.devicesTab)}
        badgeNumber={props.badgeNumbers.get(TabConstants.devicesTab)}
      />
      <Kb.SectionDivider label="Settings" />
      <SettingsItem
        text="Your account"
        selected={props.selectedTab === Constants.accountTab}
        onClick={() => props.onTabChange(Constants.accountTab)}
        badgeNumber={props.badgeNumbers.get(TabConstants.settingsTab)}
      />
      <SettingsItem
        text="Chat"
        selected={props.selectedTab === Constants.chatTab}
        onClick={() => props.onTabChange(Constants.chatTab)}
      />
      <SettingsItem
        text="Files"
        selected={props.selectedTab === Constants.fsTab}
        onClick={() => props.onTabChange(Constants.fsTab)}
      />
      <SettingsItem
        text="Notifications"
        selected={props.selectedTab === Constants.notificationsTab}
        onClick={() => props.onTabChange(Constants.notificationsTab)}
      />
      <SettingsItem
        text="Display"
        selected={props.selectedTab === Constants.displayTab}
        onClick={() => props.onTabChange(Constants.displayTab)}
      />
      <SettingsItem
        text="Feedback"
        selected={props.selectedTab === Constants.feedbackTab}
        onClick={() => props.onTabChange(Constants.feedbackTab)}
      />
      <SettingsItem
        text="Invitations"
        selected={props.selectedTab === Constants.invitationsTab}
        onClick={() => props.onTabChange(Constants.invitationsTab)}
      />
      <SettingsItem
        text="Advanced"
        selected={props.selectedTab === Constants.advancedTab}
        onClick={() => props.onTabChange(Constants.advancedTab)}
      />
      {/* TODO: Do something with logoutInProgress once Offline is
        removed from the settings page. */}
      <SettingsItem text="Sign out" selected={false} onClick={() => props.onTabChange(Constants.logOutTab)} />
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    backgroundColor: Styles.globalColors.blueGrey,
    paddingTop: Styles.globalMargins.small,
    width: 160,
  },
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

export default Styles.isPhone ? SettingsNavPhone : SettingsNav
