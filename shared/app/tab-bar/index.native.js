// @flow
import * as Tabs from '../../constants/tabs'
import * as React from 'react'
import {Box} from '../../common-adapters'
import {TabBarButton} from '../../common-adapters/tab-bar'
import {globalStyles, globalColors, isIPhoneX} from '../../styles'
import type {Props} from './index.types'

const _icons = {
  [Tabs.chatTab]: 'iconfont-nav-chat',
  [Tabs.peopleTab]: 'iconfont-nav-people',
  [Tabs.folderTab]: 'iconfont-nav-folders',
  [Tabs.settingsTab]: 'iconfont-nav-more',
  [Tabs.teamsTab]: 'iconfont-nav-teams',
}

const _tabs = [Tabs.peopleTab, Tabs.chatTab, Tabs.teamsTab, Tabs.settingsTab].filter(Boolean)

const TabBarRender = ({selectedTab, onTabClick, badgeNumbers, isNew}: Props) => (
  <Box style={stylesTabBar}>
    {_tabs.map(tab => (
      <TabBarButton
        badgeNumber={badgeNumbers[tab]}
        isNew={isNew[tab]}
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

const tabBarHeight = isIPhoneX ? 80 : 48

const stylesTabBar = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.darkBlue2,
  height: tabBarHeight,
  justifyContent: 'flex-start',
  ...(isIPhoneX
    ? {
        paddingBottom: 30,
      }
    : {}),
}

export default TabBarRender
export {tabBarHeight}
