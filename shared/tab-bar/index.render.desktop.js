// @flow

import React from 'react'
import {Box, Avatar} from '../common-adapters'
import {TabBarButton} from '../common-adapters/tab-bar'
import {globalStyles, globalColors} from '../styles'
import flags from '../util/feature-flags'
import {
  chatTab,
  profileTab,
  peopleTab,
  folderTab,
  devicesTab,
  searchTab,
  settingsTab,
} from '../constants/tabs'

import type {Props} from './index.render'

export default function TabBar ({selectedTab, onTabClick, username, badgeNumbers}: Props) {
  const avatar = (
    <Avatar
      size={32}
      onClick={() => onTabClick(profileTab)}
      username={username}
      borderColor={selectedTab === profileTab ? globalColors.white : globalColors.blue3_40}
    />
  )

  return (
    <Box style={stylesTabBar}>
      <TabBarButton
        label='Search'
        selected={selectedTab === searchTab}
        onClick={() => onTabClick(searchTab)}
        source={{type: 'nav', icon: 'iconfont-nav-search'}}
        style={stylesTabButton}
      />
      <TabBarButton
        label='Folders'
        selected={selectedTab === folderTab}
        onClick={() => onTabClick(folderTab)}
        badgeNumber={badgeNumbers[folderTab]}
        source={{type: 'nav', icon: 'iconfont-folder'}}
        style={stylesTabButton}
      />
      {flags.tabChatEnabled &&
        <TabBarButton
          label='Chat'
          selected={selectedTab === chatTab}
          onClick={() => onTabClick(chatTab)}
          badgeNumber={badgeNumbers[chatTab]}
          source={{type: 'nav', icon: 'iconfont-chat'}}
          style={stylesTabButton}
        />
      }
      {flags.tabPeopleEnabled &&
        <TabBarButton
          label='Chat'
          selected={selectedTab === peopleTab}
          onClick={() => onTabClick(peopleTab)}
          badgeNumber={badgeNumbers[peopleTab]}
          source={{type: 'nav', icon: 'iconfont-people'}}
          style={stylesTabButton}
        />
      }
      <TabBarButton
        label='Devices'
        selected={selectedTab === devicesTab}
        onClick={() => onTabClick(devicesTab)}
        badgeNumber={badgeNumbers[devicesTab]}
        source={{type: 'nav', icon: 'iconfont-device'}}
        style={stylesTabButton}
      />
      <TabBarButton
        label='Settings'
        selected={selectedTab === settingsTab}
        onClick={() => onTabClick(settingsTab)}
        badgeNumber={badgeNumbers[settingsTab]}
        source={{type: 'nav', icon: 'iconfont-settings'}}
        style={stylesTabButton}
      />
      <TabBarButton
        label={username}
        selected={selectedTab === profileTab}
        onClick={() => onTabClick(profileTab)}
        badgeNumber={badgeNumbers[profileTab]}
        source={{type: 'avatar', avatar}}
        style={{flex: 1}}
        styleContainer={{
          flex: 1,
          ...globalStyles.flexBoxColumn,
          justifyContent: 'flex-end',
        }}
      />
      {flags.tabPeopleEnabled &&
        <TabBarButton
          label='People'
          selected={selectedTab === peopleTab}
          onClick={() => onTabClick(peopleTab)}
          badgeNumber={badgeNumbers[peopleTab]}
          source={{type: 'nav', icon: 'iconfont-people'}}
          style={stylesTabButton}
        />
      }
    </Box>
  )
}

const stylesTabBar = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'flex-start',
  backgroundColor: globalColors.midnightBlue,
  paddingTop: 10,
  width: 80,
}

const stylesTabButton = {
  height: 56,
}
