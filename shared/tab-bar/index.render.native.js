// @flow
import React from 'react'
import {Box, Avatar} from '../common-adapters'
import {TabBarButton} from '../common-adapters/tab-bar'
import {globalStyles, globalColors} from '../styles'
import {profileTab, peopleTab, folderTab, devicesTab, settingsTab} from '../constants/tabs'

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
        source={{type: 'avatar', avatar}}
        style={stylesTabButton}
      />
      <TabBarButton
        selected={selectedTab === peopleTab}
        onClick={() => onTabClick(peopleTab)}
        badgeNumber={badgeNumbers[peopleTab]}
        source={{type: 'icon', icon: 'iconfont-people'}}
        style={stylesTabButton}
      />
      <TabBarButton
        selected={selectedTab === folderTab}
        onClick={() => onTabClick(folderTab)}
        badgeNumber={badgeNumbers[folderTab]}
        source={{type: 'icon', icon: 'iconfont-folder'}}
        style={stylesTabButton}
      />
      <TabBarButton
        selected={selectedTab === devicesTab}
        onClick={() => onTabClick(devicesTab)}
        badgeNumber={badgeNumbers[devicesTab]}
        source={{type: 'icon', icon: 'iconfont-device'}}
        style={stylesTabButton}
      />
      <TabBarButton
        selected={selectedTab === settingsTab}
        onClick={() => onTabClick(settingsTab)}
        badgeNumber={badgeNumbers[settingsTab]}
        source={{type: 'icon', icon: 'iconfont-settings'}}
        style={stylesTabButton}
      />
    </Box>
  )
}

const stylesTabBar = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.midnightBlue,
  justifyContent: 'space-between',
  height: 56,
}

const stylesTabButton = {
  flex: 1,
}
