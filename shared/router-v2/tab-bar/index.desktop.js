// @flow
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Tabs from '../../constants/tabs'
import './tab-bar.css'

const icons = {
  [Tabs.chatTab]: 'iconfont-nav-chat',
  [Tabs.devicesTab]: 'iconfont-nav-devices',
  [Tabs.fsTab]: 'iconfont-nav-files',
  [Tabs.gitTab]: 'iconfont-nav-git',
  [Tabs.peopleTab]: 'iconfont-nav-people',
  [Tabs.profileTab]: 'iconfont-nav-people',
  [Tabs.settingsTab]: 'iconfont-nav-settings',
  [Tabs.teamsTab]: 'iconfont-nav-teams',
  [Tabs.walletsTab]: 'iconfont-nav-wallets',
}

const labels = {
  [Tabs.chatTab]: 'Chat',
  [Tabs.devicesTab]: 'Devices',
  [Tabs.fsTab]: 'Files',
  [Tabs.gitTab]: 'Git',
  [Tabs.peopleTab]: 'People',
  [Tabs.profileTab]: 'People',
  [Tabs.settingsTab]: 'Settings',
  [Tabs.teamsTab]: 'Teams',
  [Tabs.walletsTab]: 'Wallet',
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

const TabBar = p => (
  <Kb.Box2 className="tab-container" direction="vertical" fullHeight={true}>
    <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
      <Kb.Avatar
        size={16}
        borderColor={Styles.globalColors.blue}
        username={p.username}
        style={styles.avatar}
      />
      <Kb.Text className="username" type="BodySemibold" style={styles.username}>
        Hi {p.username}
      </Kb.Text>
      <Kb.Icon type="iconfont-arrow-down" color={Styles.globalColors.blue3} />
    </Kb.Box2>
    <Kb.Divider style={styles.divider} />
    {tabs.map(t => (
      <Kb.ClickableBox key={t} onClick={() => p.onTabClick(t)}>
        <Kb.WithTooltip text={labels[t]} toastClassName="tab-tooltip">
          <Kb.Box2
            direction="horizontal"
            fullWidth={true}
            className={t === p.selectedTab ? 'tab-selected' : 'tab'}
            style={styles.tab}
          >
            <Kb.Box2 className="tab-highlight" direction="vertical" fullHeight={true} />
            <Kb.Icon className="tab-icon" type={icons[t]} />
            <Kb.Text className="tab-label" type="BodySmallSemibold">
              {labels[t]}
            </Kb.Text>
          </Kb.Box2>
        </Kb.WithTooltip>
      </Kb.ClickableBox>
    ))}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  avatar: {marginLeft: 14},
  divider: {
    marginBottom: 20,
    marginTop: Styles.globalMargins.tiny,
  },
  tab: {
    alignItems: 'center',
    height: 40,
  },
  username: {color: Styles.globalColors.blue3},
})

export default TabBar
