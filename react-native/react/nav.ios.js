'use strict'

import React, { Component, TabBarIOS, View, Navigator, Text, TouchableOpacity, StyleSheet } from 'react-native'

import { connect } from 'react-redux/native'
import MetaNavigator from './router/meta-navigator'
import globalRoutes from './router/global-routes'

import Folders from './tabs/folders'
import Chat from './tabs/chat'
import People from './tabs/people'
import Devices from './tabs/devices'
import NoTab from './tabs/no-tab'
import More from './tabs/more'
import Startup from './tabs/start-up'

import { switchTab } from './actions/tabbed-router'
import { navigateTo, navigateUp } from './actions/router'
import { startup } from './actions/config'

import * as Constants from './constants/config'

import { constants as styleConstants } from './styles/common'

import {FOLDER_TAB, CHAT_TAB, PEOPLE_TAB, DEVICES_TAB, MORE_TAB, STARTUP_TAB} from './constants/tabs'

const tabToRootComponent = {
  [FOLDER_TAB]: Folders,
  [CHAT_TAB]: Chat,
  [PEOPLE_TAB]: People,
  [DEVICES_TAB]: Devices,
  [MORE_TAB]: More,
  [STARTUP_TAB]: Startup
}

function NavigationBarRouteMapper (navigateTo, navigateUp) {
  return {
    LeftButton: function (route, navigator, index, navState) {
      if (typeof route.leftButton !== 'undefined') {
        return route.leftButton
      }

      if (index === 0) {
        return null
      }

      const previousRoute = navState.routeStack[index - 1]

      return (
        <TouchableOpacity
          onPress={() => route.upLink ? navigateTo(route.upLink) : navigateUp()}
          style={styles.navBarLeftButton}>
          <Text style={[styles.navBarText, styles.navBarButtonText]}>
            {route.upTitle || route.leftButtonTitle || previousRoute.title || 'Back'}
          </Text>
        </TouchableOpacity>
      )
    },

    RightButton: function (route, navigator, index, navState) {
      if (!route.rightButtonAction) {
        return null
      }
      return (
        <TouchableOpacity
          onPress={() => route.rightButtonAction()}
          style={styles.navBarRightButton}>
          <Text style={[styles.navBarText, styles.navBarButtonText]}>
            {route.rightButtonTitle || 'Done'}
          </Text>
        </TouchableOpacity>
      )
    },

    Title: function (route, navigator, index, navState) {
      return (
        <Text style={[styles.navBarText, styles.navBarTitleText]}>
          {route.title || ''}
        </Text>
      )
    }
  }
}

export default class Nav extends Component {
  constructor (props) {
    super(props)

    this.state = {
      startup: () => this.props.dispatch(startup()),
      navigateTo: uri => this.props.dispatch(navigateTo(uri)),
      navigateUp: () => this.props.dispatch(navigateUp()),
      switchTab: tab => this.props.dispatch(switchTab(tab))
    }

    this.state.startup()
  }

  navBar () {
    return (<Navigator.NavigationBar
             style={styles.navBar}
             routeMapper={NavigationBarRouteMapper(this.state.navigateTo, this.state.navigateUp)}/>)
  }

  _renderContent () {
    const activeTab = this.props.tabbedRouter.get('activeTab')
    return (
      <View style={styles.tabContent}>
        {React.createElement(
          connect(state => state.tabbedRouter.getIn(['tabs', state.tabbedRouter.get('activeTab')]).toObject())(MetaNavigator), {
            store: this.props.store,
            rootComponent: tabToRootComponent[activeTab] || NoTab,
            globalRoutes,
            Navigator: Navigator,
            NavBar: this.navBar(),
            navBarHeight: styleConstants.navBarHeight
          }
        )}
      </View>
    )
  }

  shouldComponentUpdate (nextProps, nextState) {
    const activeTab = this.props.tabbedRouter.get('activeTab')
    const nextActiveTab = nextProps.tabbedRouter.get('activeTab')
    if (activeTab !== nextActiveTab) {
      return true
    }

    if (this.props.config.navState !== nextProps.config.navState) {
      return true
    }

    return false
  }

  render () {
    const activeTab = this.props.tabbedRouter.get('activeTab')

    if (this.props.config.navState === Constants.navStartingUp) {
      return (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <Text>Loading...</Text>
        </View>
      )
    }

    if (activeTab === STARTUP_TAB) {
      return this._renderContent()
    }

    return (
      <View style={{flex: 1}}>
        <TabBarIOS
          tintColor='black'
          translucent={false}
          >
          <TabBarIOS.Item
            title='Folders'
            selected={activeTab === FOLDER_TAB}
            onPress={() => this.state.switchTab(FOLDER_TAB)}>
            {this._renderContent()}
          </TabBarIOS.Item>
          <TabBarIOS.Item
            title='Chat'
            selected={activeTab === CHAT_TAB}
            onPress={() => this.state.switchTab(CHAT_TAB)}>
            {this._renderContent()}
          </TabBarIOS.Item>
          <TabBarIOS.Item
            title='People'
            systemIcon='contacts'
            selected={activeTab === PEOPLE_TAB}
            onPress={() => this.state.switchTab(PEOPLE_TAB)}>
            {this._renderContent()}
          </TabBarIOS.Item>
          <TabBarIOS.Item
            title='Devices'
            selected={activeTab === DEVICES_TAB}
            onPress={() => this.state.switchTab(DEVICES_TAB)}>
            {this._renderContent()}
          </TabBarIOS.Item>
          <TabBarIOS.Item
            systemIcon='more'
            selected={activeTab === MORE_TAB}
            onPress={() => this.state.switchTab(MORE_TAB)}>
            {this._renderContent()}
          </TabBarIOS.Item>
        </TabBarIOS>
      </View>
    )
  }

  static parseRoute () {
    return {
      componentAtTop: { component: Nav },
      parseNextRoute: null
    }
  }
}

Nav.propTypes = {
  dispatch: React.PropTypes.func.isRequired,
  tabbedRouter: React.PropTypes.object.isRequired,
  store: React.PropTypes.object.isRequired,
  config: React.PropTypes.shape({
    navState: React.PropTypes.oneOf([Constants.navStartingUp, Constants.navNeedsRegistration, Constants.navNeedsLogin, Constants.navLoggedIn])
  }).isRequired
}

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
    marginBottom: styleConstants.tabBarHeight // don't sit under the tab...
  },
  navBar: {
    backgroundColor: 'white'
  },
  navBarText: {
    fontSize: 16,
    marginVertical: 10
  },
  navBarTitleText: {
    color: 'blue',
    fontWeight: '500',
    marginVertical: 9
  },
  navBarLeftButton: {
    paddingLeft: 10
  },
  navBarRightButton: {
    paddingRight: 10
  },
  navBarButtonText: {
    color: 'blue'
  }
})
