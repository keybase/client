// @flow
import * as Tabs from '../../constants/tabs'
import * as React from 'react'
import {Box} from '../../common-adapters'
import {TabBarButton} from '../../common-adapters/tab-bar'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import type {Props} from './index.types'

const _icons = {
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

const _labels = {
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

const TabBarRender = ({onTabClick, selectedTab, username, badgeNumbers}: Props) => (
  <Box style={stylesTabBar}>
    {Tabs.desktopTabOrder.map(tab => (
      <TabBarButton
        className="keybase-nav"
        badgeNumber={badgeNumbers[tab]}
        isNav={true}
        key={tab}
        label={_labels[tab]}
        onClick={() => onTabClick(tab)}
        selected={selectedTab === tab}
        source={{icon: _icons[tab], type: 'nav'}}
        style={selectedTab ? stylesSelectedTabButton : stylesTabButton}
      />
    ))}
    <Box style={{flex: 1}} />
    <TabBarButton
      label={username || ''}
      isNav={true}
      selected={false}
      onClick={() => onTabClick(Tabs.profileTab)}
      badgeNumber={badgeNumbers[Tabs.profileTab]}
      source={{type: 'avatar', username}}
      style={stylesTabButton}
    />
  </Box>
)

const stylesTabBar = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.darkBlue2,
  justifyContent: 'flex-start',
  paddingBottom: globalMargins.tiny,
  paddingTop: globalMargins.small,
  width: 80,
}

const stylesTabButton = {
  color: globalColors.blue3_40,
  height: 56,
}

const stylesSelectedTabButton = {
  ...stylesTabButton,
  color: globalColors.white,
}

export default TabBarRender
