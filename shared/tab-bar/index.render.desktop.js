// @flow

import React, {Component} from 'react'
import {Box, TabBar, Avatar} from '../common-adapters'
import {TabBarButton, TabBarItem} from '../common-adapters/tab-bar'
import {globalStyles, globalColors} from '../styles'
import flags from '../util/feature-flags'

import {profileTab, peopleTab, folderTab, devicesTab, settingsTab, chatTab, tabPrettify} from '../constants/tabs'

import type {Tab} from '../constants/tabs'
import type {IconType} from '../common-adapters/icon'
import type {Props} from './index.render'

const icons: {[key: Tab]: IconType} = {
  [peopleTab]: 'iconfont-people',
  ...(flags.tabChatEnabled ? {[chatTab]: 'iconfont-chat'} : null),
  [folderTab]: 'iconfont-folder',
  [devicesTab]: 'iconfont-device',
  [settingsTab]: 'iconfont-settings',
}

export type SearchButton = 'TabBar:searchButton'
export const searchButton = 'TabBar:searchButton'

function tabToIcon (t: Tab): IconType {
  return icons[t]
}

export default class TabBarRender extends Component<void, Props, void> {
  _renderSearch (onClick: () => void) {
    const source = {type: 'nav', icon: 'iconfont-nav-search'}
    const button = (
      <TabBarButton
        label='Search'
        selected={this.props.searchActive}
        source={source} />
    )

    return (
      <TabBarItem
        key='search'
        tabBarButton={button}
        selected={!!this.props.searchActive}
        onClick={onClick}
        style={{...stylesTabBarItem}}
      >
        <Box style={{flex: 1, ...globalStyles.flexBoxColumn}}>{this.props.searchContent || <Box />}</Box>
      </TabBarItem>
    )
  }

  _renderProfileButton (tab: Tab, selected: boolean, onClick: () => void) {
    // $FlowIssue
    const avatar: Avatar = <Avatar size={32} onClick={onClick} username={this.props.username} borderColor={selected ? globalColors.white : globalColors.blue3_40} />
    const source = {type: 'avatar', avatar}
    const label = this.props.username
    return (
      <TabBarButton
        label={label}
        selected={selected}
        badgeNumber={this.props.badgeNumbers[tab]}
        source={source} />
    )
  }

  _renderNormalButton (tab: Tab, selected: boolean, onClick: () => void) {
    const source = {type: 'nav', icon: tabToIcon(tab)}
    const label = tabPrettify(tab)
    return (
      <TabBarButton
        style={stylesTabButton}
        label={label}
        selected={selected}
        badgeNumber={this.props.badgeNumbers[tab]}
        source={source} />
    )
  }

  _renderTabItems () {
    // $FlowIssue
    const tabs: Array<VisibleTab> = [
      folderTab,
      ...(flags.tabChatEnabled ? [chatTab] : []),
      ...(flags.tabPeopleEnabled ? [peopleTab] : []),
      devicesTab,
      settingsTab,
      profileTab,
    ].filter(Boolean)

    return tabs.map((t: VisibleTab) => {
      const onClick = () => this.props.onTabClick(t)
      const isProfile = t === profileTab

      const selected = !this.props.searchActive && this.props.selectedTab === t
      const button = isProfile ? this._renderProfileButton(t, selected, onClick) : this._renderNormalButton(t, selected, onClick)

      return (
        <TabBarItem
          key={t}
          tabBarButton={button}
          selected={selected}
          onClick={onClick}
          style={{...stylesTabBarItem}}
          styleContainer={{...(isProfile ? {flex: 1, ...globalStyles.flexBoxColumn, justifyContent: 'flex-end'} : {})}}
        >
          <Box style={{flex: 1, ...globalStyles.flexBoxColumn}}>{this.props.tabContent[t]}</Box>
        </TabBarItem>
      )
    })
  }

  render () {
    let tabItems = [this._renderSearch(this.props.onSearchClick || (() => {}))]
    tabItems = tabItems.concat(this._renderTabItems())

    return (
      <TabBar style={stylesTabBarContainer}
        styleTabBar={{...stylesTabBar}}>
        {tabItems}
      </TabBar>
    )
  }
}

const stylesTabBarContainer = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  height: 580,
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

const stylesTabBarItem = {
  ...globalStyles.flexBoxColumn,
}
