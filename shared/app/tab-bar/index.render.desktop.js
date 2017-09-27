// @flow
import * as Tabs from '../../constants/tabs'
import * as React from 'react'
import flags from '../../util/feature-flags'
import {Box} from '../../common-adapters'
import {TabBarButton} from '../../common-adapters/tab-bar'
import {globalStyles, globalColors, globalMargins} from '../../styles'

import type {Props} from './index.render'

const _icons = {
  [Tabs.chatTab]: 'iconfont-nav-chat',
  [Tabs.devicesTab]: 'iconfont-nav-devices',
  [Tabs.folderTab]: 'iconfont-nav-folders',
  [Tabs.peopleTab]: 'iconfont-nav-people',
  [Tabs.profileTab]: 'iconfont-nav-people',
  [Tabs.settingsTab]: 'iconfont-nav-settings',
  [Tabs.teamsTab]: 'iconfont-nav-teams',
  [Tabs.gitTab]: 'iconfont-nav-git',
}

const _labels = {
  [Tabs.chatTab]: 'Chat',
  [Tabs.devicesTab]: 'Devices',
  [Tabs.folderTab]: 'Folders',
  [Tabs.peopleTab]: 'People',
  [Tabs.profileTab]: 'People',
  [Tabs.settingsTab]: 'Settings',
  [Tabs.teamsTab]: 'Teams',
  [Tabs.gitTab]: 'Git',
}

const _tabs = [
  ...(flags.tabPeopleEnabled ? [Tabs.peopleTab] : []),
  Tabs.chatTab,
  Tabs.folderTab,
  ...(flags.teamChatEnabled ? [Tabs.teamsTab] : []),
  Tabs.devicesTab,
  ...(flags.tabGitEnabled ? [Tabs.gitTab] : []),
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
        source={{icon: _icons[tab], type: 'nav'}}
        style={selectedTab ? stylesSelectedTabButton : stylesTabButton}
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
  paddingBottom: globalMargins.tiny,
  paddingTop: globalMargins.small,
  width: 80,
}

const stylesTabButton = {
  height: 56,
  color: globalColors.blue3_40,
}

const stylesSelectedTabButton = {
  ...stylesTabButton,
  color: globalColors.white,
}

export default TabBarRender
