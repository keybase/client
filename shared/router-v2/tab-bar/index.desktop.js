// @flow
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Tabs from '../../constants/tabs'
import KeyHandler from '../../util/key-handler.desktop'
import {isDarwin} from '../../constants/platform'
import type {Props} from '.'
import './tab-bar.css'

const data = {
  [Tabs.chatTab]: {icon: 'iconfont-nav-chat', label: 'Chat'},
  [Tabs.devicesTab]: {icon: 'iconfont-nav-devices', label: 'Devices'},
  [Tabs.fsTab]: {icon: 'iconfont-nav-files', label: 'Files'},
  [Tabs.gitTab]: {icon: 'iconfont-nav-git', label: 'Git'},
  [Tabs.peopleTab]: {icon: 'iconfont-nav-people', label: 'People'},
  [Tabs.profileTab]: {icon: 'iconfont-nav-people', label: 'People'},
  [Tabs.settingsTab]: {icon: 'iconfont-nav-settings', label: 'Settings'},
  [Tabs.teamsTab]: {icon: 'iconfont-nav-teams', label: 'Teams'},
  [Tabs.walletsTab]: {icon: 'iconfont-nav-wallets', label: 'Wallet'},
}

const tabs = [
  Tabs.peopleTab,
  Tabs.chatTab,
  Tabs.fsTab,
  Tabs.teamsTab,
  Tabs.walletsTab,
  Tabs.gitTab,
  Tabs.devicesTab,
  Tabs.settingsTab,
]

// $FlowIssue
const TabBar = KeyHandler(
  (p: Props) =>
    !!p.username && (
      <Kb.Box2 className="tab-container" direction="vertical" fullHeight={true}>
        <Kb.Box2 direction="vertical" style={styles.header} fullWidth={true}>
          <Kb.Box2 direction="horizontal" style={styles.osButtons} fullWidth={true} />
          <Kb.ClickableBox onClick={p.onProfileClick}>
            <Kb.Box2
              direction="horizontal"
              gap="tiny"
              fullWidth={true}
              style={styles.nameContainer}
              alignItems="center"
            >
              <Kb.Avatar
                size={24}
                borderColor={Styles.globalColors.blue}
                username={p.username}
                style={styles.avatar}
              />
              <Kb.Text className="username" type="BodyTinySemibold" style={styles.username}>
                Hi {p.username}!
              </Kb.Text>
              <Kb.Icon
                type="iconfont-arrow-down"
                color={Styles.globalColors.blue3}
                fontSize={12}
                style={styles.caret}
              />
            </Kb.Box2>
          </Kb.ClickableBox>
          <Kb.Divider style={styles.divider} />
        </Kb.Box2>
        {tabs.map(t => (
          <Kb.ClickableBox key={t} onClick={() => p.onTabClick(t)}>
            <Kb.WithTooltip text={data[t].label} toastClassName="tab-tooltip">
              <Kb.Box2
                direction="horizontal"
                fullWidth={true}
                className={t === p.selectedTab ? 'tab-selected' : 'tab'}
                style={styles.tab}
              >
                <Kb.Box2 className="tab-highlight" direction="vertical" fullHeight={true} />
                <Kb.Icon className="tab-icon" type={data[t].icon} sizeType="Big" />
                <Kb.Text className="tab-label" type="BodySmallSemibold">
                  {data[t].label}
                </Kb.Text>
                {!!p.badgeNumbers[t] && <Kb.Badge className="tab-badge" badgeNumber={p.badgeNumbers[t]} />}
              </Kb.Box2>
            </Kb.WithTooltip>
          </Kb.ClickableBox>
        ))}
      </Kb.Box2>
    )
)

const styles = Styles.styleSheetCreate({
  avatar: {marginLeft: 14},
  caret: {marginRight: 12},
  divider: {marginTop: Styles.globalMargins.tiny},
  header: {height: 80, marginBottom: 20},
  nameContainer: {height: 24},
  osButtons: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.windowDragging,
      flexGrow: 1,
    },
  }),
  tab: {
    alignItems: 'center',
    paddingRight: 12,
    position: 'relative',
  },
  username: {color: Styles.globalColors.blue3, flexGrow: 1},
})

const keysMap = Tabs.desktopTabOrder.reduce((map, tab, index) => {
  map[`${isDarwin ? 'command' : 'ctrl'}+${index + 1}`] = tab
  return map
}, {})
const hotkeys = Object.keys(keysMap)

class HotKeyTabBar extends React.Component<Props> {
  _onHotkey = cmd => {
    this.props.onTabClick(keysMap[cmd])
  }
  render() {
    return <TabBar {...this.props} hotkeys={hotkeys} onHotkey={this._onHotkey} />
  }
}

export default HotKeyTabBar
