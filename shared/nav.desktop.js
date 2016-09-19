// @flow
import {remote, ipcRenderer} from 'electron'

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {globalStyles} from './styles'
import MetaNavigator from './router/meta-navigator'
import globalRoutes from './router/global-routes'
import Folders from './folders'
import Chat from './chat'
import People from './people'
import Devices from './devices'
import NoTab from './no-tab'
import Profile from './profile/container'
import Search from './search'
import Settings from './settings'
import Login from './login'
import flags from './util/feature-flags'
import {mapValues} from 'lodash'
import type {Tabs} from './constants/tabs'

import {profileTab, folderTab, chatTab, peopleTab, devicesTab, settingsTab, loginTab} from './constants/tabs'
import {navigateBack, navigateUp, switchTab} from './actions/router'
import {setActive} from './actions/search'
import TabBar from './tab-bar/index.render'

const tabs = {
  [settingsTab]: {module: Settings, name: 'Settings'},
  [profileTab]: {module: Profile, name: 'Profile'},
  [folderTab]: {module: Folders, name: 'Folders'},
  [chatTab]: {module: Chat, name: 'Chat'},
  [peopleTab]: {module: People, name: 'People'},
  [devicesTab]: {module: Devices, name: 'Devices'},
}

type Props = {
  menuBadge: boolean,
  switchTab: (tab: Tabs) => void,
  router: Object,
  provisioned: boolean,
  username: string,
  navigateBack: () => void,
  navigateUp: () => void,
  folderBadge: number,
  searchActive: boolean,
  setSearchActive: (active: boolean) => void,
}

class Nav extends Component<void, Props, void> {
  _lastCheckedTab: ?Tabs;
  _checkingTab: boolean;
  _originalSize: $Shape<{width: number, height: number}>;
  _handleKeyDown: (e: SyntheticKeyboardEvent) => void;

  constructor (props) {
    super(props)
    this._handleKeyDown = this._handleKeyDown.bind(this)

    this._lastCheckedTab = null // the last tab we resized for
  }

  _handleTabsChange (e) {
    this.props.switchTab(e)
  }

  _checkTabChanged () {
    if (this._checkingTab) {
      return
    }

    this._checkingTab = true

    setImmediate(() => {
      this._checkingTab = false
      const currentWindow = remote.getCurrentWindow()

      if (!currentWindow) {
        return
      }

      const activeTab = this._activeTab()

      if (this._lastCheckedTab === activeTab) {
        return
      }

      this._lastCheckedTab = activeTab

      ipcRenderer.send('tabChanged', activeTab)
    })
  }

  _activeTab () {
    return this.props.router.get('activeTab')
  }

  _handleKeyDown (e: SyntheticKeyboardEvent) {
    const modKey = process.platform === 'darwin' ? e.metaKey : e.ctrlKey
    if (modKey && e.key === 'ArrowLeft') {
      e.preventDefault()
      this.props.navigateBack()
      return
    }
    if (modKey && e.key === 'ArrowUp') {
      e.preventDefault()
      this.props.navigateUp()
      return
    }
  }

  shouldComponentUpdate (nextProps, nextState) {
    if (this.props.folderBadge !== nextProps.folderBadge) {
      return true
    }

    if (this.props.menuBadge !== nextProps.menuBadge) {
      ipcRenderer.send(this.props.menuBadge ? 'showTrayRegular' : 'showTrayBadged')
    }

    if (this.props.searchActive !== nextProps.searchActive) {
      return true
    }

    return (nextProps.router.get('activeTab') !== this._activeTab())
  }

  componentDidMount () {
    this._checkTabChanged()
    if (flags.admin) window.addEventListener('keydown', this._handleKeyDown)
  }

  componentDidUpdate () {
    this._checkTabChanged()
  }

  componentWillUnmount () {
    if (flags.admin) window.removeEventListener('keydown', this._handleKeyDown)
  }

  _renderContent (tab, module) {
    return (
      <MetaNavigator
        tab={tab}
        globalRoutes={globalRoutes}
        rootComponent={module || NoTab} />
    )
  }

  render () {
    const activeTab = this._activeTab()

    if (activeTab === loginTab) {
      return (
        <div style={stylesTabsContainer}>
          <MetaNavigator
            tab={loginTab}
            rootComponent={Login} />
        </div>
      )
    }

    const tabContent = mapValues(tabs, ({module}, tab) => (activeTab === tab && this._renderContent(tab, module)))
    return (
      <div style={stylesTabsContainer}>
        <TabBar
          onTabClick={t => this._handleTabsChange(t)}
          selectedTab={activeTab}
          onSearchClick={() => this.props.setSearchActive(!this.props.searchActive)}
          searchActive={this.props.searchActive}
          username={this.props.username}
          searchContent={<Search />}
          badgeNumbers={{[folderTab]: this.props.folderBadge}}
          tabContent={tabContent} />
      </div>
    )
  }
}

const stylesTabsContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

// $FlowIssue type this connector
export default connect(
  ({
    search: {searchActive},
    router,
    config: {extendedConfig, username},
    favorite: {publicBadge = 0, privateBadge = 0},
    notifications: {menuBadge}}) => ({
      router,
      searchActive,
      provisioned: extendedConfig && !!extendedConfig.defaultDeviceID,
      username,
      menuBadge,
      folderBadge: flags.tabFoldersEnabled ? publicBadge + privateBadge : 0,
    }),
  dispatch => {
    return {
      switchTab: tab => dispatch(switchTab(tab)),
      navigateBack: () => dispatch(navigateBack()),
      navigateUp: () => dispatch(navigateUp()),
      setSearchActive: (active) => { dispatch(setActive(active)) },
    }
  }
)(Nav)
