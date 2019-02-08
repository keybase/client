// @flow
// TODO badging
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Tabs from '../../constants/tabs'

const icons = {
  [Tabs.chatTab]: 'iconfont-nav-chat',
  [Tabs.teamsTab]: 'iconfont-nav-teams',
  [Tabs.peopleTab]: 'iconfont-nav-people',
  [Tabs.settingsTab]: 'iconfont-nav-more',
  [Tabs.walletsTab]: 'iconfont-nav-wallets',
}

const tabs = [Tabs.peopleTab, Tabs.chatTab, Tabs.teamsTab, Tabs.settingsTab]
const TabBar = p =>
  !!p.username && (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
      {tabs.map(t => (
        <Kb.Icon
          key={t}
          type={icons[t]}
          onClick={() => p.onTabClick(t)}
          fontSize={32}
          style={t === p.selectedTab ? styles.tabSelected : styles.tab}
          color={t === p.selectedTab ? Styles.globalColors.white : Styles.globalColors.darkBlue4}
        />
      ))}
    </Kb.Box2>
  )

const tab = {}
const styles = Styles.styleSheetCreate({
  container: {
    alignItems: 'center',
    backgroundColor: Styles.globalColors.darkBlue2,
    height: Styles.isAndroid ? 56 : 48,
    justifyContent: 'space-around',
  },
  tab: {
    ...tab,
  },
  tabSelected: {
    ...tab,
  },
})

export default TabBar
