import {remote} from 'electron'

import {Component} from 'react'
import {connect} from 'react-redux'
import MetaNavigator from './router/meta-navigator'
import React from 'react'
import Folders from './folders'
import Chat from './chat'
import People from './people'
import Devices from './devices'
import NoTab from './no-tab'
import More from './more'
import Login from './login'
import commonStyles from './styles/common'
import flags from './util/feature-flags'

// TODO global routes
// import globalRoutes from './router/global-routes'
const globalRoutes = {}

import {folderTab, chatTab, peopleTab, devicesTab, moreTab, loginTab} from './constants/tabs'
import {switchTab} from './actions/tabbed-router'
import {Tab, Tabs} from 'material-ui'

import {bootstrap} from './actions/config'
import {globalResizing} from './styles/style-guide'

const tabs = {
  [moreTab]: {module: More, name: 'More'},
  [folderTab]: {module: Folders, name: 'Folders'},
  [chatTab]: {module: Chat, name: 'Chat'},
  [peopleTab]: {module: People, name: 'People'},
  [devicesTab]: {module: Devices, name: 'Devices'}
}

class TabTemplate extends Component {
  render () {
    return (
      <div style={styles.tabTemplate}>
        {this.props.children}
      </div>
    )
  }
}

TabTemplate.propTypes = {
  children: React.PropTypes.node,
  selected: React.PropTypes.bool
}

class Nav extends Component {
  constructor (props) {
    super(props)
    this.props.bootstrap()

    // Restartup when we connect online.
    // If you startup while offline, you'll stay in an errored state
    window.addEventListener('online', () => this.props.bootstrap())

    this._lastResizedTab = null // the last tab we resized for
  }

  _handleTabsChange (e, key, payload) {
    this.props.switchTab(e)
  }

  _resizeWindow () {
    if (this._askedResize) {
      return
    }

    this._askedResize = true

    setImmediate(() => {
      this._askedResize = false
      const currentWindow = remote.getCurrentWindow()

      if (!currentWindow) {
        return
      }

      const activeTab = this._activeTab()

      if (this._lastResizedTab === activeTab) {
        return
      }

      const oldWasLogin = this._lastResizedTab === loginTab
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
        currentWindow.show()
      } else if (oldWasLogin) {
        if (!flags.mainWindow) {
          currentWindow.hide()
        }

        if (this._originalSize) {
          const {width, height} = this._originalSize
          currentWindow.setContentSize(width, height, true)
        } else {
          currentWindow.setContentSize(globalResizing.normal.width, globalResizing.normal.height, true)
        }
        currentWindow.setResizable(true)
      }

      this._lastResizedTab = activeTab
    })
  }

  _activeTab () {
    return this.props.tabbedRouter.get('activeTab')
  }

  shouldComponentUpdate (nextProps, nextState) {
    return (nextProps.tabbedRouter.get('activeTab') !== this._activeTab())
  }

  componentDidMount () {
    this._resizeWindow()
  }

  componentDidUpdate () {
    this._resizeWindow()
  }

  render () {
    const activeTab = this._activeTab()

    if (activeTab === loginTab) {
      return (
        <div style={styles.tabsContainer}>
          <MetaNavigator
            tab={loginTab}
            globalRoutes={globalRoutes}
            rootComponent={Login} />
        </div>
      )
    }

    if (!flags.mainWindow) {
      return <div>Coming soon!</div>
    }

    return (
      <div style={styles.tabsContainer}>
        <Tabs
          style={styles.tabs}
          valueLink={{value: activeTab, requestChange: this._handleTabsChange.bind(this)}}
          contentContainerStyle={styles.tab}
          tabTemplate={TabTemplate}>
          {Object.keys(tabs).map(tab => {
            const {module, name} = tabs[tab]
            return (
              <Tab label={name} value={tab} key={tab} >
                {activeTab === tab &&
                  <MetaNavigator
                    tab={tab}
                    globalRoutes={globalRoutes}
                    rootComponent={module || NoTab}
                  />}
              </Tab>
            )
          })}
        </Tabs>
      </div>
    )
  }
}

const styles = {
  tab: {
    ...commonStyles.flexBoxColumn,
    flex: 1,
    position: 'relative'
  },
  tabs: {
    ...commonStyles.flexBoxColumn,
    flex: 1
  },
  tabsContainer: {
    ...commonStyles.flexBoxColumn,
    flex: 1
  },
  tabTemplate: {
    ...commonStyles.flexBoxColumn,
    overflow: 'auto',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  }
}

Nav.propTypes = {
  switchTab: React.PropTypes.func.isRequired,
  tabbedRouter: React.PropTypes.object.isRequired,
  config: React.PropTypes.shape({
    error: React.PropTypes.object
  }).isRequired
}

export default connect(
  store => store,
  dispatch => {
    return {
      switchTab: tab => dispatch(switchTab(tab)),
      bootstrap: () => dispatch(bootstrap())
    }
  }
)(Nav)
