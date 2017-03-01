// @flow

import React, {PureComponent} from 'react'
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

const _searchSource = {type: 'nav', icon: 'iconfont-nav-search'}
const _folderSource = {type: 'nav', icon: 'iconfont-folder'}
const _chatSource = {type: 'nav', icon: 'iconfont-chat'}
const _peopleSource = {type: 'nav', icon: 'iconfont-people'}
const _devicesSource = {type: 'nav', icon: 'iconfont-device'}
const _settingsSource = {type: 'nav', icon: 'iconfont-settings'}

class TabBar extends PureComponent<void, Props, void> {
  _onSearch = () => this.props.onTabClick(searchTab)
  _onFolder = () => this.props.onTabClick(folderTab)
  _onChat = () => this.props.onTabClick(chatTab)
  _onPeople = () => this.props.onTabClick(peopleTab)
  _onDevice = () => this.props.onTabClick(devicesTab)
  _onSettings = () => this.props.onTabClick(settingsTab)
  _onProfile = () => this.props.onTabClick(profileTab)

  render () {
    const {selectedTab, username, badgeNumbers} = this.props
    const avatar = (
      <Avatar
        size={32}
        onClick={this._onProfile}
        username={username}
        borderColor={selectedTab === profileTab ? globalColors.white : globalColors.blue3_40}
        loadingColor={globalColors.blue3_40}
        backgroundColor={selectedTab === profileTab ? globalColors.white : globalColors.blue3_40}
      />
    )

    return (
      <Box style={stylesTabBar}>
        <TabBarButton
          label='Search'
          selected={selectedTab === searchTab}
          onClick={this._onSearch}
          source={_searchSource}
          style={stylesTabButton} />
        <TabBarButton
          label='Folders'
          selected={selectedTab === folderTab}
          onClick={this._onFolder}
          badgeNumber={badgeNumbers[folderTab]}
          source={_folderSource}
          style={stylesTabButton} />
        <TabBarButton
          label='Chat'
          selected={selectedTab === chatTab}
          onClick={this._onChat}
          badgeNumber={badgeNumbers[chatTab]}
          source={_chatSource}
          style={stylesTabButton} />
        {flags.tabPeopleEnabled &&
          <TabBarButton
            label='People'
            selected={selectedTab === peopleTab}
            onClick={this._onPeople}
            badgeNumber={badgeNumbers[peopleTab]}
            source={_peopleSource}
            style={stylesTabButton} />
        }
        <TabBarButton
          label='Devices'
          selected={selectedTab === devicesTab}
          onClick={this._onDevice}
          badgeNumber={badgeNumbers[devicesTab]}
          source={_devicesSource}
          style={stylesTabButton} />
        <TabBarButton
          label='Settings'
          selected={selectedTab === settingsTab}
          onClick={this._onSettings}
          badgeNumber={badgeNumbers[settingsTab]}
          source={_settingsSource}
          style={stylesTabButton} />
        <Box style={{flex: 1}} />
        <TabBarButton
          label={username}
          selected={selectedTab === profileTab}
          onClick={this._onProfile}
          badgeNumber={badgeNumbers[profileTab]}
          source={{type: 'avatar', avatar}} />
      </Box>
    )
  }
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

export default TabBar
