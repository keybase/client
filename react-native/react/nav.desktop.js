import {Component} from './base-react'
import {connect} from './base-redux'
import MetaNavigator from './router/meta-navigator'
import React from 'react'
import Folders from './folders'
import Chat from './chat'
import People from './people'
import Devices from './devices'
import NoTab from './no-tab'
import More from './more'
import commonStyles from './styles/common'
// TODO global routes
// import globalRoutes from './router/global-routes'
const globalRoutes = {}

import * as Constants from './constants/config'
import {folderTab, chatTab, peopleTab, devicesTab, moreTab} from './constants/tabs'
import {switchTab} from './actions/tabbed-router'
import {startup} from './actions/config'
import {Tab, Tabs} from 'material-ui'

const tabs = {
  [moreTab]: {module: More, name: 'More'},
  [folderTab]: {module: Folders, name: 'Folders'},
  [chatTab]: {module: Chat, name: 'Chat'},
  [peopleTab]: {module: People, name: 'People'},
  [devicesTab]: {module: Devices, name: 'Devices'}
}

class TabTemplate extends Component {
  render () {
    /* If we decide to show content for non-active tabs
    if (this.props.selected) {
      delete styles.height;
      delete styles.overflow;
    }
    */

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
    this.props.startup()
  }

  _handleTabsChange (e, key, payload) {
    this.props.switchTab(e)
  }

  render () {
    const activeTab = this.props.tabbedRouter.get('activeTab')

    if (this.props.config.navState === Constants.navStartingUp) {
      return (
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <h1>Loading...</h1>
        </div>
      )
    }

    return (
      <div style={styles.tabsContainer}>
        <Tabs
          style={styles.tabs}
          valueLink={{value: activeTab, requestChange: this._handleTabsChange.bind(this)}}
          contentContainerStyle={styles.tab}
          tabTemplate={TabTemplate}>
          { Object.keys(tabs).map(tab => {
            const {module, name} = tabs[tab]
            return (
              <Tab label={name} value={tab} key={tab} >
                { activeTab === tab &&
                  <MetaNavigator
                    tab={tab}
                    globalRoutes={globalRoutes}
                    rootComponent={module || NoTab}
                  /> }
              </Tab>
            )
          }) }
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
  // navigateBack: React.PropTypes.func.isRequired,
  startup: React.PropTypes.func.isRequired,
  tabbedRouter: React.PropTypes.object.isRequired,
  config: React.PropTypes.shape({
    navState: React.PropTypes.oneOf([
      Constants.navStartingUp,
      Constants.navNeedsRegistration,
      Constants.navNeedsLogin,
      Constants.navLoggedIn,
      Constants.navErrorStartingUp]),
    error: React.PropTypes.object
  }).isRequired
}

export default connect(
  store => store,
  dispatch => {
    return {
      switchTab: tab => dispatch(switchTab(tab)),
      // navigateBack: () => dispatch(navigateBack()),
      startup: () => dispatch(startup())
    }
  }
)(Nav)
