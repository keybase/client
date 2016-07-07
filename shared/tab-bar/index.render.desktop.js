// @flow

import React, {Component} from 'react'
import {Box, TabBar, Avatar, Icon} from '../common-adapters'
import {TabBarButton, TabBarItem} from '../common-adapters/tab-bar'
import {globalStyles, globalColors} from '../styles/style-guide'
import flags from '../util/feature-flags'

import {profileTab, peopleTab, folderTab, devicesTab, settingsTab} from '../constants/tabs'

import type {VisibleTab} from '../constants/tabs'
import type {IconType} from '../common-adapters/icon'
import type {Props} from './index.render'

const icons: {[key: VisibleTab]: IconType} = {
  [peopleTab]: 'fa-kb-iconfont-people',
  [folderTab]: 'fa-kb-iconfont-folder',
  [devicesTab]: 'fa-kb-iconfont-device',
  [settingsTab]: 'fa-kb-iconfont-settings',
}

const labels: {[key: VisibleTab]: IconType} = {
  [peopleTab]: 'PEOPLE',
  [folderTab]: 'FOLDERS',
  [devicesTab]: 'DEVICES',
  [settingsTab]: 'SETTINGS',
}

export type SearchButton = 'TabBar:searchButton'
export const searchButton = 'TabBar:searchButton'

function tabToIcon (t: VisibleTab): IconType {
  return icons[t]
}

function tabToLabel (t: VisibleTab): string {
  return labels[t]
}

export default class Render extends Component<void, Props, void> {
  _renderSearch (onClick: () => void) {
    const backgroundColor = this.props.searchActive ? globalColors.orange : globalColors.darkBlue
    const button = (
      <Box style={{...globalStyles.flexBoxColumn, padding: 24}}>
        <Box style={{...stylesSearchButton, backgroundColor}}>
          <Icon type='fa-kb-iconfont-search' style={{color: globalColors.white, fontSize: 32}} />
        </Box>
      </Box>
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

  _renderProfileButton (tab: VisibleTab, selected: boolean, onClick: () => void) {
    // $FlowIssue
    const avatar: Avatar = <Avatar size={32} onClick={onClick} username={this.props.username} />
    const source = {type: 'avatar', avatar}
    const label = this.props.username
    return (
      <TabBarButton
        label={label}
        styleLabel={{fontSize: 14, marginTop: 4}}
        selected={selected}
        badgeNumber={this.props.badgeNumbers[tab]}
        source={source} />
    )
  }

  _renderNormalButton (tab: VisibleTab, selected: boolean, onClick: () => void) {
    const source = {type: 'icon', icon: tabToIcon(tab)}
    const label = tabToLabel(tab)
    return (
      <TabBarButton
        style={stylesTabButton}
        styleLabel={{fontSize: 13}}
        styleLabelType='BodySemibold'
        label={label}
        selected={selected}
        badgeNumber={this.props.badgeNumbers[tab]}
        source={source} />
    )
  }

  _renderVisibleTabItems () {
    const tabs = [folderTab, devicesTab, settingsTab, profileTab]
    if (flags.tabPeopleEnabled) tabs.push(peopleTab)

    return tabs.map(t => {
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
    tabItems = tabItems.concat(this._renderVisibleTabItems())

    return (
      <TabBar style={stylesTabBarContainer}
        styleTabBar={{...stylesTabBar, backgroundColor: globalColors.midnightBlue}}>
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
  width: 160,
}

const stylesTabButton = {
  height: 40,
}

const stylesTabBarItem = {
  ...globalStyles.flexBoxColumn,
}

const stylesSearchButton = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  alignItems: 'center',
  alignSelf: 'center',
  height: 80,
  width: 80,
  borderRadius: 100,
  boxShadow: `0 2px 10px 0 ${globalColors.black_20}`,
}
