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

import { switchTab } from './actions/tabbed-router'
import { navigateTo, navigateUp } from './actions/router'
import { startup } from './actions/config'

import { constants as styleConstants } from './styles/common'

import {FOLDER_TAB, CHAT_TAB, PEOPLE_TAB, DEVICES_TAB, MORE_TAB} from './constants/tabs'

const tabToRootComponent = {
  [FOLDER_TAB]: Folders,
  [CHAT_TAB]: Chat,
  [PEOPLE_TAB]: People,
  [DEVICES_TAB]: Devices,
  [MORE_TAB]: More
}

function NavigationBarRouteMapper (dispatch) {
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
          onPress={() => dispatch(route.upLink ? navigateTo(route.upLink) : navigateUp())}
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
          onPress={() => dispatch(route.rightButtonAction)}
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
    this.props.dispatch(startup())
  }

  navBar () {
    const {dispatch} = this.props
    return (<Navigator.NavigationBar
             style={styles.navBar}
             routeMapper={NavigationBarRouteMapper(dispatch)}/>)
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

    if (this.props.config.loaded !== nextProps.config.loaded) {
      return true
    }

    return false
  }

  render () {
    const {dispatch} = this.props
    const activeTab = this.props.tabbedRouter.get('activeTab')

    if (!this.props.config.loaded) {
      return (
        <Text style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          Loading...
        </Text>
      )
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
            onPress={() => dispatch(switchTab(FOLDER_TAB))}>
            {this._renderContent()}
          </TabBarIOS.Item>
          <TabBarIOS.Item
            title='Chat'
            selected={activeTab === CHAT_TAB}
            onPress={() => dispatch(switchTab(CHAT_TAB))}>
            {this._renderContent()}
          </TabBarIOS.Item>
          <TabBarIOS.Item
            title='People'
            systemIcon='contacts'
            selected={activeTab === PEOPLE_TAB}
            onPress={() => dispatch(switchTab(PEOPLE_TAB))}>
            {this._renderContent()}
          </TabBarIOS.Item>
          <TabBarIOS.Item
            title='Devices'
            selected={activeTab === DEVICES_TAB}
            onPress={() => dispatch(switchTab(DEVICES_TAB))}>
            {this._renderContent()}
          </TabBarIOS.Item>
          <TabBarIOS.Item
            systemIcon='more'
            selected={activeTab === MORE_TAB}
            onPress={() => dispatch(switchTab(MORE_TAB))}>
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
    loaded: React.PropTypes.bool.isRequired
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
