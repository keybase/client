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
// TODO global routes
// import globalRoutes from './router/global-routes'
const globalRoutes = {}

import * as Constants from './constants/config'
import {folderTab, chatTab, peopleTab, devicesTab, moreTab} from './constants/tabs'
import {switchTab} from './actions/tabbed-router'
import {startup} from './actions/config'
import {Tab, Tabs, Styles} from 'material-ui'
let {Colors, Typography} = Styles

const tabs = {
  [moreTab]: {module: More, name: 'More'},
  [folderTab]: {module: Folders, name: 'Folders'},
  [chatTab]: {module: Chat, name: 'Chat'},
  [peopleTab]: {module: People, name: 'People'},
  [devicesTab]: {module: Devices, name: 'Devices'}
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
        <Tabs valueLink={{value: activeTab, requestChange: this._handleTabsChange.bind(this)}}>
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
  div: {
    position: 'absolute',
    left: 48,
    backgroundColor: Colors.cyan500,
    width: 0,
    height: 48
  },
  headline: {
    fontSize: 24,
    lineHeight: '32px',
    paddingTop: 16,
    marginBottom: 12,
    letterSpacing: 0,
    fontWeight: Typography.fontWeightNormal,
    color: Typography.textDarkBlack
  },
  iconButton: {
    position: 'absolute',
    left: 0,
    backgroundColor: Colors.cyan500,
    color: 'white',
    marginRight: 0
  },
  iconStyle: {
    color: Colors.white
  },
  tabs: {
    position: 'relative'
  },
  tabsContainer: {
    position: 'relative',
    paddingLeft: 0,
    width: '70%'
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
