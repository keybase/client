// @flow
import * as Tabs from '../../constants/tabs'
import * as React from 'react'
import {Box} from '../../common-adapters'
import {TabBarButton} from '../../common-adapters/tab-bar'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import type {Props} from './index.types'

const _icons = {
  [Tabs.chatTab]: 'iconfont-nav-2-chat',
  [Tabs.devicesTab]: 'iconfont-nav-2-devices',
  [Tabs.fsTab]: 'iconfont-nav-2-files',
  [Tabs.gitTab]: 'iconfont-nav-2-git',
  [Tabs.peopleTab]: 'iconfont-nav-2-people',
  [Tabs.profileTab]: 'iconfont-nav-2-people',
  [Tabs.settingsTab]: 'iconfont-nav-2-settings',
  [Tabs.teamsTab]: 'iconfont-nav-2-teams',
  [Tabs.walletsTab]: 'iconfont-nav-2-wallets',
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

const TabBarRender = ({onTabClick, selectedTab, username, badgeNumbers, isNew}: Props) => (
  <Box style={stylesTabBar}>
    {Tabs.desktopTabOrder.map(tab => (
      <TabBarButton
        className="keybase-nav"
        badgeNumber={badgeNumbers[tab]}
        isNav={true}
        isNew={isNew[tab] || false}
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
      isNew={false}
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
