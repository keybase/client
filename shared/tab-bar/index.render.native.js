// @flow
import React from 'react'
import {Box} from '../common-adapters'
import {TabBarButton} from '../common-adapters/tab-bar'
import {globalStyles, globalColors} from '../styles'
import {profileTab, folderTab, chatTab, settingsTab, searchTab} from '../constants/tabs'

import type {Props} from './index.render'

export default function TabBarRender({selectedTab, onTabClick, username, badgeNumbers}: Props) {
  return (
    <Box style={stylesTabBar}>
      <TabBarButton
        accessibilityLabel="Profile"
        selected={selectedTab === profileTab}
        onClick={() => onTabClick(profileTab)}
        badgeNumber={badgeNumbers[profileTab]}
        badgePosition="top-right"
        source={{type: 'avatar', username}}
        style={stylesTabButton}
      />
      <TabBarButton
        accessibilityLabel="Folders"
        selected={selectedTab === folderTab}
        onClick={() => onTabClick(folderTab)}
        badgeNumber={badgeNumbers[folderTab]}
        badgePosition="top-right"
        source={{type: 'icon', icon: 'iconfont-folder'}}
        style={stylesTabButton}
      />
      <TabBarButton
        accessibilityLabel="Search"
        selected={selectedTab === searchTab}
        onClick={() => onTabClick(searchTab)}
        badgeNumber={badgeNumbers[searchTab]}
        badgePosition="top-right"
        source={{type: 'icon', icon: 'iconfont-nav-search'}}
        styleIcon={{fontSize: 34}}
        style={stylesTabButton}
      />
      <TabBarButton
        accessibilityLabel="Chat"
        selected={selectedTab === chatTab}
        onClick={() => onTabClick(chatTab)}
        badgeNumber={badgeNumbers[chatTab]}
        badgePosition="top-right"
        source={{type: 'icon', icon: 'iconfont-chat'}}
        styleIcon={{fontSize: 30, marginTop: -2}}
        style={stylesTabButton}
      />
      <TabBarButton
        accessibilityLabel="Settings"
        selected={selectedTab === settingsTab}
        onClick={() => onTabClick(settingsTab)}
        badgeNumber={badgeNumbers[settingsTab]}
        badgePosition="top-right"
        source={{type: 'icon', icon: 'iconfont-settings'}}
        style={stylesTabButton}
      />
    </Box>
  )
}

export const tabBarHeight = 48

const stylesTabBar = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.midnightBlue,
  justifyContent: 'space-between',
  height: tabBarHeight,
}

const stylesTabButton = {
  flex: 1,
}
