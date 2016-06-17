// @flow
import {remote, ipcRenderer} from 'electron'

import React, {Component} from 'react'
import {connect} from 'react-redux'
import MetaNavigator from './router/meta-navigator'
import Folders from './folders'
import Chat from './chat'
import People from './people'
import Devices from './devices'
import NoTab from './no-tab'
import Profile from './profile'
import Search from './search'
import Settings from './settings'
import Login from './login'
import commonStyles from './styles/common'
import flags from './util/feature-flags'
import {mapValues} from 'lodash'
import type {Tabs} from './constants/tabs'

import {profileTab, folderTab, chatTab, peopleTab, devicesTab, settingsTab, loginTab} from './constants/tabs'
import {switchTab} from './actions/tabbed-router'
import TabBar from './tab-bar/index.render'

import {bootstrap} from './actions/config'
import {globalResizing} from './styles/style-guide'

const tabs = {
  [settingsTab]: {module: Settings, name: 'Settings'},
  [profileTab]: {module: Profile, name: 'Profile'},
  [folderTab]: {module: Folders, name: 'Folders'},
  [chatTab]: {module: Chat, name: 'Chat'},
  [peopleTab]: {module: People, name: 'People'},
  [devicesTab]: {module: Devices, name: 'Devices'},
}

type State = {
  searchActive: boolean
}

type Props = {
  menuBadge: boolean,
  bootstrap: () => void,
  switchTab: (tab: Tabs) => void,
  tabbedRouter: Object,
  bootstrapped: boolean,
  provisioned: boolean,
  username: string
}

class Nav extends Component<void, Props, State> {
  state: State;
  _lastCheckedTab: ?Tabs;
  _checkingTab: boolean;
  _originalSize: $Shape<{width: number, height: number}>;

  constructor (props) {
    super(props)
    this._setupDebug()
    this.props.bootstrap()

    this.state = {searchActive: false}

    // Restartup when we connect online.
    // If you startup while offline, you'll stay in an errored state
    window.addEventListener('online', () => this.props.bootstrap())

    this._lastCheckedTab = null // the last tab we resized for
  }

  _setupDebug () {
    if (__DEV__ && process.env.KEYBASE_LOCAL_DEBUG) {
      require('devtron').install()
    }
  }

  _handleTabsChange (e, key, payload) {
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

      const oldWasLogin = this._lastCheckedTab === loginTab
      const newIsLogin = activeTab === loginTab

      // going to/from login?
      if (newIsLogin) {
        const [width, height] = currentWindow.getContentSize()

        // Did we actually change the size
        if (width !== globalResizing.login.width && height !== globalResizing.login.height) {
          this._originalSize = {width, height}
        }

        currentWindow.setContentSize(globalResizing.login.width, globalResizing.login.height, true)
        currentWindow.setResizable(false)

        if (flags.mainWindow) {
          ipcRenderer.send('showMain')
        }
      } else if (oldWasLogin) {
        if (!flags.mainWindow) {
          // We close since that will hide the window and release the dock icon
          currentWindow.close()
        }

        if (this._originalSize) {
          const {width, height} = this._originalSize
          currentWindow.setContentSize(width, height, true)
        } else {
          currentWindow.setContentSize(globalResizing.normal.width, globalResizing.normal.height, true)
        }
        currentWindow.setResizable(true)
      }

      this._lastCheckedTab = activeTab
    })
  }

  _activeTab () {
    return this.props.tabbedRouter.get('activeTab')
  }

  shouldComponentUpdate (nextProps, nextState) {
    if (this.props.menuBadge !== nextProps.menuBadge) {
      ipcRenderer.send(this.props.menuBadge ? 'showTrayRegular' : 'showTrayBadged')
    }

    if (this.state.searchActive !== nextState.searchActive) {
      return true
    }

    return (nextProps.tabbedRouter.get('activeTab') !== this._activeTab())
  }

  componentDidMount () {
    this._checkTabChanged()
  }

  componentDidUpdate () {
    this._checkTabChanged()
  }

  _renderContent (tab, module) {
    return (
      <MetaNavigator
        tab={tab}
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

    if (!flags.mainWindow) {
      return <div>Coming soon!</div>
    }

    const tabContent = mapValues(tabs, ({module}, tab) => (activeTab === tab && this._renderContent(tab, module)))

    return (
      <div style={stylesTabsContainer}>
        <TabBar
          onTabClick={t => this._handleTabsChange(t)}
          selectedTab={activeTab}
          onSearchClick={() => this.setState({searchActive: !this.state.searchActive})}
          searchActive={this.state.searchActive}
          username={this.props.username}
          searchContent={<Search />}
          badgeNumbers={{}}
          tabContent={tabContent} />
      </div>
    )
  }
}

const stylesTabsContainer = {
  ...commonStyles.flexBoxColumn,
  flex: 1,
}

export default connect(
  ({tabbedRouter, config: {bootstrapped, extendedConfig, username}, notifications: {menuBadge}}) => ({
    tabbedRouter,
    bootstrapped,
    provisioned: extendedConfig && !!extendedConfig.device,
    username,
    menuBadge,
  }),
  dispatch => {
    return {
      switchTab: tab => dispatch(switchTab(tab)),
      bootstrap: () => dispatch(bootstrap()),
    }
  }
)(Nav)
