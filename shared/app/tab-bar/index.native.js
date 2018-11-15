// @flow
import * as Tabs from '../../constants/tabs'
import * as React from 'react'
import {Box} from '../../common-adapters'
import {TabBarButton} from '../../common-adapters/tab-bar'
import {globalStyles, globalColors} from '../../styles'
import type {Props} from './index.types'

const _icons = {
  [Tabs.chatTab]: 'iconfont-nav-chat',
  [Tabs.peopleTab]: 'iconfont-nav-people',
  [Tabs.folderTab]: 'iconfont-nav-folders',
  [Tabs.settingsTab]: 'iconfont-nav-more',
  [Tabs.teamsTab]: 'iconfont-nav-teams',
}

const _tabs = [Tabs.peopleTab, Tabs.chatTab, Tabs.teamsTab, Tabs.settingsTab].filter(Boolean)

// Files, Git, Devices, and Wallet are under the settings tab on mobile
// bubble badges up to the tab
const settingsTabChildren = [Tabs.fsTab, Tabs.gitTab, Tabs.devicesTab, Tabs.walletsTab]
const getSettingsTabBadge = (badgeNumbers: $PropertyType<Props, 'badgeNumbers'>) =>
  settingsTabChildren.reduce((res, tab) => res + (badgeNumbers[tab] || 0), 0)

const TabBarRender = ({selectedTab, onTabClick, badgeNumbers, isNew}: Props) => (
  <Box style={stylesTabBar}>
    {_tabs.map(tab => (
      <TabBarButton
        badgeNumber={tab === Tabs.settingsTab ? getSettingsTabBadge(badgeNumbers) : badgeNumbers[tab]}
        isNew={isNew[tab] || false}
        badgePosition="top-right"
        key={tab}
        isNav={true}
        onClick={() => onTabClick(tab)}
        selected={selectedTab === tab}
        source={{icon: _icons[tab], type: 'icon'}}
        styleIcon={selectedTab === tab ? _selectedIconStyle : _iconStyle}
      />
    ))}
  </Box>
)

const _iconStyle = {
  color: globalColors.darkBlue4,
  fontSize: 32,
}
const _selectedIconStyle = {
  ..._iconStyle,
  color: globalColors.white,
}

export const tabBarHeight = 48

const stylesTabBar = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.darkBlue2,
  height: tabBarHeight,
  justifyContent: 'flex-start',
}

export default TabBarRender
