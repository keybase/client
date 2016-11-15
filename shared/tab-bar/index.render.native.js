// @flow

import React, {Component} from 'react'
import {TabBar, Avatar} from '../common-adapters'
import {TabBarButton, TabBarItem} from '../common-adapters/tab-bar'
import {globalColors} from '../styles'

import {profileTab, peopleTab, folderTab, devicesTab, settingsTab} from '../constants/tabs'

import type {Tab} from '../constants/tabs'
import type {IconType} from '../common-adapters/icon'
import type {Props} from './index.render'

const icons: {[key: Tab]: IconType} = {
  [peopleTab]: 'iconfont-people',
  [folderTab]: 'iconfont-folder',
  [devicesTab]: 'iconfont-device',
  [settingsTab]: 'iconfont-settings',
}

function tabToIcon (t: Tab): IconType {
  return icons[t]
}

export default class TabBarRender extends Component<void, Props, void> {
  render () {
    const badgeNumbers = this.props.badgeNumbers
    const tabs = [profileTab, peopleTab, folderTab, devicesTab, settingsTab]

    return (
      <TabBar style={{flex: 1}}
        tabBarOnBottom={true}
        styleTabBar={stylesTabBar}>

        {tabs.map(t => {
          const onPress = () => this.props.onTabClick(t)

          // $FlowIssue Need to figure this out...
          const avatar: Avatar = <Avatar size={32} onClick={onPress} username={this.props.username} />
          const source = t === profileTab ? {type: 'avatar', avatar}
            : {type: 'icon', icon: tabToIcon(t)}
          const button = (
            <TabBarButton
              selected={this.props.selectedTab === t}
              badgeNumber={badgeNumbers[t]}
              source={source} />
          )

          return (
            <TabBarItem
              key={t} tabBarButton={button} selected={this.props.selectedTab === t} onClick={onPress} styleContainer={{flex: 1}}>
              {this.props.tabContent[t]}
            </TabBarItem>
          )
        })}
      </TabBar>
    )
  }
}

const stylesTabBar = {
  backgroundColor: globalColors.midnightBlue,
  justifyContent: 'space-between',
  height: 56
}
