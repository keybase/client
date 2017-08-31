// @flow
import * as Tabs from '../../constants/tabs'
import * as React from 'react'
import {Box} from '../../common-adapters'
import flags from '../../util/feature-flags'
import {TabBarButton} from '../../common-adapters/tab-bar'
import {globalStyles, globalColors} from '../../styles'

import type {Props} from './index.render'

const _icons = {
  [Tabs.chatTab]: {selected: 'icon-nav-chat-selected-40', unselected: 'icon-nav-chat-40'},
  [Tabs.folderTab]: {selected: 'icon-nav-folders-selected-40', unselected: 'icon-nav-folders-40'},
  [Tabs.profileTab]: {selected: 'icon-nav-people-selected-40', unselected: 'icon-nav-people-40'},
  [Tabs.settingsTab]: {selected: 'icon-nav-settings-selected-40', unselected: 'icon-nav-settings-40'},
  // TODO: Use teams icon when it becomes available.
  [Tabs.teamsTab]: {selected: 'icon-nav-chat-selected-32', unselected: 'icon-nav-chat-32'},
}

// TODO: Implement a ... icon and put folderTab and settingsTab behind
// it.
const _tabs = [
  Tabs.profileTab,
  ...(flags.teamChatEnabled ? [Tabs.teamsTab] : []),
  Tabs.folderTab,
  Tabs.chatTab,
  Tabs.settingsTab,
].filter(Boolean)

const TabBarRender = ({selectedTab, onTabClick, badgeNumbers}: Props) => (
  <Box style={stylesTabBar}>
    {_tabs.map(tab => (
      <TabBarButton
        badgeNumber={badgeNumbers[tab]}
        badgePosition="top-right"
        key={tab}
        isNav={true}
        onClick={() => onTabClick(tab)}
        selected={selectedTab === tab}
        source={{icon: _icons[tab][selectedTab === tab ? 'selected' : 'unselected'], type: 'icon'}}
        styleIcon={{opacity: selectedTab === tab ? 1 : 0.6}}
      />
    ))}
  </Box>
)

const tabBarHeight = 48

const stylesTabBar = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.darkBlue2,
  height: tabBarHeight,
  justifyContent: 'flex-start',
}

export default TabBarRender
export {tabBarHeight}
