// @flow
import React from 'react'
import {Box, Avatar} from '../common-adapters'
import {TabBarButton} from '../common-adapters/tab-bar'
import {globalStyles, globalColors} from '../styles'
import {profileTab, folderTab, chatTab, settingsTab, searchTab} from '../constants/tabs'

import type {Props} from './index.render'

export default function TabBarRender ({selectedTab, onTabClick, username, badgeNumbers}: Props) {
  const avatar = <Avatar
    size={32}
    onClick={() => onTabClick(profileTab)}
    username={username}
  />

  return (
    <Box style={stylesTabBar}>
      <TabBarButton
        selected={selectedTab === profileTab}
        onClick={() => onTabClick(profileTab)}
        badgeNumber={badgeNumbers[profileTab]}
        badgePosition='top-right'
        source={{type: 'avatar', avatar}}
        style={stylesTabButton}
      />
      <TabBarButton
        selected={selectedTab === folderTab}
        onClick={() => onTabClick(folderTab)}
        badgeNumber={badgeNumbers[folderTab]}
        badgePosition='top-right'
        source={{type: 'icon', icon: 'iconfont-folder'}}
        style={stylesTabButton}
      />
      <TabBarButton
        selected={selectedTab === searchTab}
        onClick={() => onTabClick(searchTab)}
        badgeNumber={badgeNumbers[searchTab]}
        badgePosition='top-right'
        source={{type: 'icon', icon: 'iconfont-nav-search'}}
        style={stylesTabButton}
      />
      <TabBarButton
        selected={selectedTab === chatTab}
        onClick={() => onTabClick(chatTab)}
        badgeNumber={badgeNumbers[chatTab]}
        badgePosition='top-right'
        source={{type: 'icon', icon: 'iconfont-chat'}}
        style={stylesTabButton}
      />
      <TabBarButton
        selected={selectedTab === settingsTab}
        onClick={() => onTabClick(settingsTab)}
        badgeNumber={badgeNumbers[settingsTab]}
        badgePosition='top-right'
        source={{type: 'icon', icon: 'iconfont-settings'}}
        style={stylesTabButton}
      />
    </Box>
  )
}

export const tabBarHeight = 56

const stylesTabBar = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.midnightBlue,
  justifyContent: 'space-between',
  height: tabBarHeight,
}

const stylesTabButton = {
  flex: 1,
}
