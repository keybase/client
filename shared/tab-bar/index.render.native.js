// @flow

import React, {Component} from 'react'
import {TabBar, Avatar} from '../common-adapters'
import {TabBarButton} from '../common-adapters/tab-bar'

import {profileTab, peopleTab, folderTab, devicesTab, moreTab} from '../constants/tabs'

import type {VisibleTab} from '../constants/tabs'
import type {Props as IconProps} from '../common-adapters/icon'
import type {Props} from './index.render'

const icons: {[key: VisibleTab]: IconProps.type} = {
  [peopleTab]: 'fa-users',
  [folderTab]: 'fa-folder',
  [devicesTab]: 'phone-bw-m',
  [moreTab]: 'fa-cog'
}

export function tabToIcon (t: VisibleTab): IconProps.type {
  return icons[t]
}

export default class Render extends Component<void, Props, void> {
  render () {
    const badgeNumbers = this.props.badgeNumbers
    const tabs = [profileTab, peopleTab, folderTab, devicesTab, moreTab]

    return (
      <TabBar style={{flex: 1}}
        tabBarOnBottom
        tabBarStyle={stylesTabBar}>

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
            <TabBar.Item
              key={t} tabBarButton={button} selected={this.props.selectedTab === t} onPress={onPress} containerStyle={{flex: 1}}>
              {this.props.tabContent[t]}
            </TabBar.Item>
          )
        })}
      </TabBar>
    )
  }
}

const stylesTabBar = {justifyContent: 'space-between', height: 56}
