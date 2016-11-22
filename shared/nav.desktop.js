// @flow
import Chat from './chat/container'
import Devices from './devices'
import Folders from './folders'
import GlobalError from './global-errors/container'
import Login from './login'
import MetaNavigator from './router/meta-navigator'
import NoTab from './no-tab'
import People from './people'
import Profile from './profile/container'
import React, {Component} from 'react'
import Search from './search'
import Settings from './settings'
import TabBar from './tab-bar/index.render'
import flags from './util/feature-flags'
import globalRoutes from './router/global-routes'
import {connect} from 'react-redux'
import {globalStyles} from './styles'
import {isDarwin} from './constants/platform'
import {mapValues} from 'lodash'
import {navigateBack, navigateUp, switchTab} from './actions/router'
import {profileTab, folderTab, chatTab, peopleTab, devicesTab, settingsTab, loginTab} from './constants/tabs'
import {remote, ipcRenderer} from 'electron'
import {setActive} from './actions/search'

import type {Tab} from './constants/tabs'

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
  switchTab: (tab: Tab) => void,
  router: Object,
  provisioned: boolean,
  username: string,
  navigateBack: () => void,
  navigateUp: () => void,
  folderBadge: number,
  chatBadge: number,
  searchActive: boolean,
  setSearchActive: (active: boolean) => void,
}

class Nav extends Component<void, Props, void> {
  _lastCheckedTab: ?Tab;
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
    const modKey = isDarwin ? e.metaKey : e.ctrlKey
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
    // MUST be first
    if (this.props.menuBadge !== nextProps.menuBadge) {
      ipcRenderer.send('showTray', nextProps.menuBadge)
    }

    if (this.props.folderBadge !== nextProps.folderBadge) {
      return true
    }

    if (this.props.chatBadge !== nextProps.chatBadge) {
      return true
    }

    if (this.props.searchActive !== nextProps.searchActive) {
      return true
    }

    return (nextProps.router.get('activeTab') !== this._activeTab())
  }

  componentDidMount () {
    this._checkTabChanged()
    if (flags.admin) window.addEventListener('keydown', this._handleKeyDown)
    ipcRenderer.send('showTray', this.props.menuBadge)
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
          <GlobalError />
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
          badgeNumbers={{[folderTab]: this.props.folderBadge, [chatTab]: this.props.chatBadge}}
          tabContent={tabContent} />
        <GlobalError />
      </div>
    )
  }
}

const stylesTabsContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  position: 'relative',
}

// $FlowIssue type this connector
export default connect(
  ({
    search: {searchActive},
    router,
    config: {extendedConfig, username},
    notifications: {menuBadge, menuNotifications}}) => ({
      router,
      searchActive,
      provisioned: extendedConfig && !!extendedConfig.defaultDeviceID,
      username,
      menuBadge,
      folderBadge: menuNotifications.folderBadge,
      chatBadge: menuNotifications.chatBadge,
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
