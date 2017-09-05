// @flow
import * as Tabs from '../../constants/tabs'
import * as React from 'react'
import flags from '../../util/feature-flags'
import {Box} from '../../common-adapters'
import {TabBarButton} from '../../common-adapters/tab-bar'
import {globalStyles, globalColors} from '../../styles'

import type {Props} from './index.render'

const _icons = {
  [Tabs.chatTab]: {selected: 'icon-nav-chat-selected-32', unselected: 'icon-nav-chat-32'},
  [Tabs.devicesTab]: {selected: 'icon-nav-devices-selected-32', unselected: 'icon-nav-devices-32'},
  [Tabs.folderTab]: {selected: 'icon-nav-folders-selected-32', unselected: 'icon-nav-folders-32'},
  [Tabs.peopleTab]: {selected: 'icon-nav-people-selected-32', unselected: 'icon-nav-people-32'},
  [Tabs.profileTab]: {selected: 'icon-nav-people-selected-32', unselected: 'icon-nav-people-32'},
  [Tabs.searchTab]: {selected: 'icon-nav-people-selected-32', unselected: 'icon-nav-people-32'},
  [Tabs.settingsTab]: {selected: 'icon-nav-settings-selected-32', unselected: 'icon-nav-settings-32'},
  // TODO: Use teams icon when it becomes available.
  [Tabs.teamsTab]: {selected: 'icon-nav-chat-selected-32', unselected: 'icon-nav-chat-32'},
}

const _labels = {
  [Tabs.chatTab]: 'Chat',
  [Tabs.devicesTab]: 'Devices',
  [Tabs.folderTab]: 'Folders',
  [Tabs.peopleTab]: 'People',
  [Tabs.profileTab]: 'People',
  [Tabs.searchTab]: 'Search',
  [Tabs.settingsTab]: 'Settings',
  [Tabs.teamsTab]: 'Teams',
}

const _tabs = [
  ...(flags.tabPeopleEnabled ? [Tabs.profileTab] : []),
  Tabs.folderTab,
  Tabs.chatTab,
  ...(flags.teamChatEnabled ? [Tabs.teamsTab] : []),
  Tabs.devicesTab,
  Tabs.settingsTab,
].filter(Boolean)

const TabBarRender = ({onTabClick, selectedTab, username, badgeNumbers}: Props) => (
  <Box style={stylesTabBar}>
    {_tabs.map(tab => (
      <TabBarButton
        className="keybase-nav"
        badgeNumber={badgeNumbers[tab]}
        isNav={true}
        key={tab}
        label={_labels[tab]}
        onClick={() => onTabClick(tab)}
        selected={selectedTab === tab}
        source={{icon: _icons[tab][selectedTab === tab ? 'selected' : 'unselected'], type: 'nav'}}
        style={stylesTabButton}
      />
    ))}
    <Box style={{flex: 1}} />
    <TabBarButton
      label={username}
      isNav={true}
      selected={false}
      onClick={() => onTabClick(Tabs.profileTab)}
      badgeNumber={badgeNumbers[Tabs.peopleTab]}
      source={{type: 'avatar', username}}
      style={stylesTabButton}
    />
  </Box>
)

const stylesTabBar = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.darkBlue2,
  justifyContent: 'flex-start',
  paddingBottom: 15,
  paddingTop: 15,
  width: 80,
}

const stylesTabButton = {
  height: 56,
}

export default TabBarRender
