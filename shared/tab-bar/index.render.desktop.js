// @flow

import React, {Component} from 'react'
import {Box, TabBar, Avatar, Icon, Text} from '../common-adapters'
import {TabBarButton} from '../common-adapters/tab-bar'
import {globalStyles, globalColors} from '../styles/style-guide'

import {profileTab, peopleTab, folderTab, devicesTab, moreTab} from '../constants/tabs'

import type {VisibleTab} from '../constants/tabs'
import type {Props as IconProps} from '../common-adapters/icon'
import type {Props} from './index.render'

const icons: {[key: VisibleTab]: IconProps.type} = {
  [peopleTab]: 'fa-custom-main-nav-people',
  [folderTab]: 'fa-custom-main-nav-folders',
  [devicesTab]: 'fa-custom-main-nav-devices',
  [moreTab]: 'fa-custom-main-nav-settings'
}

const labels: {[key: VisibleTab]: IconProps.type} = {
  [peopleTab]: 'PEOPLE',
  [folderTab]: 'FOLDERS',
  [devicesTab]: 'DEVICES',
  [moreTab]: 'SETTINGS'
}

export type SearchButton = 'TabBar:searchButton'
export const searchButton = 'TabBar:searchButton'

function tabToIcon (t: VisibleTab): IconProps.type {
  return icons[t]
}

function tabToLabel (t: VisibleTab): string {
  return labels[t]
}

export default class Render extends Component<void, Props, void> {
  _renderSearch (onPress: () => void, searchActive: boolean) {
    const backgroundColor = searchActive ? globalColors.orange : globalColors.darkBlue
    const button = (
      <Box style={{...globalStyles.flexBoxColumn, padding: 24}}>
        <Box style={{...stylesSearchButton, backgroundColor}}>
          <Icon type='fa-custom-main-nav-people' style={{color: globalColors.white, fontSize: 24}}/>
        </Box>
      </Box>
    )

    return (
      <TabBar.Item
        key='search' tabBarButton={button}
        selected={searchActive}
        onPress={onPress} containerStyle={{...stylesTabBarItem}}>
        <Text type='Body'>Todo: add search here</Text>
      </TabBar.Item>
    )
  }

  _renderProfileButton (tab: VisibleTab, onPress: () => void) {
    // $FlowIssue
    const avatar: Avatar = <Avatar size={32} onClick={onPress} username={this.props.username} />
    const source = {type: 'avatar', avatar}
    const label = this.props.username
    return (
      <TabBarButton
        style={{flex: 0}}
        label={label}
        selected={this.props.selectedTab === tab}
        badgeNumber={this.props.badgeNumbers[tab]}
        source={source} />
    )
  }

  _renderNormalButton (tab: VisibleTab, onPress: () => void) {
    const source = {type: 'icon', icon: tabToIcon(tab)}
    const label = tabToLabel(tab)
    return (
      <TabBarButton
        style={stylesTabButton}
        label={label}
        selected={this.props.selectedTab === tab}
        badgeNumber={this.props.badgeNumbers[tab]}
        source={source} />
    )
  }

  _renderVisibleTabItems () {
    const tabs = [peopleTab, folderTab, devicesTab, moreTab, profileTab]

    return tabs.map(t => {
      const onPress = () => this.props.onTabClick(t)
      const isProfile = t === profileTab

      const button = isProfile ? this._renderProfileButton(t, onPress) : this._renderNormalButton(t, onPress)

      return (
        <TabBar.Item
          key={t} tabBarButton={button}
          selected={this.props.selectedTab === t} onPress={onPress} containerStyle={{...stylesTabBarItem, ...(isProfile && {flex: 2, justifyContent: 'flex-end'})}}>
          {this.props.tabContent[t]}
        </TabBar.Item>
      )
    })
  }

  render () {
    const searchActive = !!this.props.searchActive
    const backgroundColor = searchActive ? globalColors.white : globalColors.midnightBlue

    let tabItems = [this._renderSearch(this.props.onSearchClick || (() => {}), searchActive)]

    if (!searchActive) {
      tabItems = tabItems.concat(this._renderVisibleTabItems())
    }

    return (
      <TabBar style={stylesTabBarContainer}
        tabBarStyle={{...stylesTabBar, backgroundColor}}>
        {tabItems}
      </TabBar>
    )
  }
}

const stylesTabBarContainer = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  height: 580
}

const stylesTabBar = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'flex-start',
  width: 160
}

const stylesTabButton = {
  height: 40
}

const stylesTabBarItem = {
  ...globalStyles.flexBoxColumn,
  flex: 0
}

const stylesSearchButton = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  alignItems: 'center',
  alignSelf: 'center',
  height: 80,
  width: 80,
  borderRadius: 100,
  boxShadow: `0 2px 10px 0 ${globalColors.black_20}`
}
