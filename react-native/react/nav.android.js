'use strict'

import TabBar from './native/tab-bar'
import { connect } from 'react-redux/native'
import MetaNavigator from './router/meta-navigator'
import globalRoutes from './router/global-routes'

import Folders from './tabs/folders'
import Chat from './tabs/chat'
import People from './tabs/people'
import Devices from './tabs/devices'
import NoTab from './tabs/no-tab'
import More from './tabs/more'

import React, { Component, Text, View, StyleSheet, BackAndroid } from 'react-native'

import {FOLDER_TAB, CHAT_TAB, PEOPLE_TAB, DEVICES_TAB, MORE_TAB} from './constants/tabs'
import { androidTabBarHeight } from './styles/native'

import { switchTab } from './actions/tabbed-router'
import { navigateBack } from './actions/router'
import { startup } from './actions/config'

const tabToRootComponent = {
  [FOLDER_TAB]: Folders,
  [CHAT_TAB]: Chat,
  [PEOPLE_TAB]: People,
  [DEVICES_TAB]: Devices,
  [MORE_TAB]: More
}

class AndroidNavigator extends Component {
  constructor (props) {
    super(props)
  }

  push (componentAtTop) {
    return false
  }

  getCurrentRoutes () {
    return []
  }

  popToRoute (targetRoute) {
    return false
  }

  immediatelyResetRouteStack () {
    return false
  }

  render () {
    let componentAtTop = this.props.initialRouteStack[this.props.initialRouteStack.length - 1]
    return this.props.renderScene(componentAtTop, null)
  }
}

AndroidNavigator.propTypes = {
  initialRouteStack: React.PropTypes.array.isRequired,
  renderScene: React.PropTypes.func.isRequired
}

export default class Nav extends Component {
  constructor (props) {
    super(props)
    this.props.dispatch(startup())
  }

  _renderContent (activeTab) {
    return (
      <View style={styles.tabContent} collapsable={false}>
        {React.createElement(
          connect(state => state.tabbedRouter.getIn(['tabs', activeTab]).toObject())(MetaNavigator), {
            store: this.props.store,
            rootComponent: tabToRootComponent[activeTab] || NoTab,
            globalRoutes,
            navBarHeight: 0,
            Navigator: AndroidNavigator,
            NavBar: <View/>
          }
        )}
      </View>
    )
  }

  componentWillMount () {
    BackAndroid.addEventListener('hardwareBackPress', () => {
      // TODO Properly handle android back button press
      const currentRoute = this.props.tabbedRouter.getIn(['tabs', this.props.tabbedRouter.get('activeTab'), 'uri'])
      const {dispatch} = this.props
      if (currentRoute == null || currentRoute.count() <= 1) {
        return false
      }
      dispatch(navigateBack())
      return true
    })
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
      <TabBar style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0}}>
          <TabBar.Item
            title='Folders'
            selected={activeTab === FOLDER_TAB}
            onPress={() => dispatch(switchTab(FOLDER_TAB))}>
            {this._renderContent(FOLDER_TAB)}
          </TabBar.Item>
          <TabBar.Item
            title='Chat'
            selected={activeTab === CHAT_TAB}
            onPress={() => dispatch(switchTab(CHAT_TAB))}>
            {this._renderContent(CHAT_TAB)}
          </TabBar.Item>
          <TabBar.Item
            title='People'
            systemIcon='contacts'
            selected={activeTab === PEOPLE_TAB}
            onPress={() => dispatch(switchTab(PEOPLE_TAB))}>
            {this._renderContent(PEOPLE_TAB)}
          </TabBar.Item>
          <TabBar.Item
            title='Devices'
            selected={activeTab === DEVICES_TAB}
            onPress={() => dispatch(switchTab(DEVICES_TAB))}>
            {this._renderContent(DEVICES_TAB)}
          </TabBar.Item>
          <TabBar.Item
            title='more'
            selected={activeTab === MORE_TAB}
            onPress={() => dispatch(switchTab(MORE_TAB))}>
            {this._renderContent(MORE_TAB)}
          </TabBar.Item>
      </TabBar>
    )
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
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    marginBottom: androidTabBarHeight
  }
})
