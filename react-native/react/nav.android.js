'use strict'

import React from 'react-native'
import TabBar from './native/TabBar'
import { connect } from 'react-redux/native'
import MetaNavigator from './router/meta-navigator.js'

import Folders from './tabs/folders'
import Chat from './tabs/chat'
import People from './tabs/people'
import Devices from './tabs/devices'
import NoTab from './tabs/no-tab'
import More from './tabs/more'

import {
  Component,
  View,
  StyleSheet,
  BackAndroid
} from 'react-native'

import {FOLDER_TAB, CHAT_TAB, PEOPLE_TAB, DEVICES_TAB, MORE_TAB} from './constants/tabs'
import { switchTab } from './actions/tabbedRouter'

const tabToRootRouteParse = {
  [FOLDER_TAB]: Folders.parseRoute,
  [CHAT_TAB]: Chat.parseRoute,
  [PEOPLE_TAB]: People.parseRoute,
  [DEVICES_TAB]: Devices.parseRoute,
  [MORE_TAB]: More.parseRoute
}

class Nav extends Component {
  constructor (props) {
    super(props)
  }

  _renderContent (color, activeTab) {
    return (
      <View style={[styles.tabContent, {backgroundColor: color}]}>
        {React.createElement(
          connect(state => state.tabbedRouter.getIn(['tabs', state.tabbedRouter.get('activeTab')]).toObject())(MetaNavigator),
          {store: this.props.store, rootRouteParser: tabToRootRouteParse[activeTab] || NoTab.parseRoute}
        )}
      </View>
    )
  }

  componentWillMount () {
    BackAndroid.addEventListener('hardwareBackPress', () => {
      // TODO Properly handle android back button press
      return false
    })
  }

  render () {
    const {dispatch} = this.props
    const activeTab = this.props.tabbedRouter.get('activeTab')

    return (
      <TabBar style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0}}>
          <TabBar.Item
            title='Folders'
            selected={activeTab === FOLDER_TAB}
            onPress={() => dispatch(switchTab(FOLDER_TAB))}>
            {this._renderContent('#414A8C', FOLDER_TAB)}
          </TabBar.Item>
          <TabBar.Item
            title='Chat'
            selected={activeTab === CHAT_TAB}
            onPress={() => dispatch(switchTab(CHAT_TAB))}>
            {this._renderContent('#417A8C', CHAT_TAB)}
          </TabBar.Item>
          <TabBar.Item
            title='People'
            systemIcon='contacts'
            selected={activeTab === PEOPLE_TAB}
            onPress={() => dispatch(switchTab(PEOPLE_TAB))}>
            {this._renderContent('#214A8C', PEOPLE_TAB)}
          </TabBar.Item>
          <TabBar.Item
            title='Devices'
            selected={activeTab === DEVICES_TAB}
            onPress={() => dispatch(switchTab(DEVICES_TAB))}>
            {this._renderContent('#783E33', DEVICES_TAB)}
          </TabBar.Item>
          <TabBar.Item
            title='more'
            selected={activeTab === MORE_TAB}
            onPress={() => dispatch(switchTab(MORE_TAB))}>
            {this._renderContent('#21551C', MORE_TAB)}
          </TabBar.Item>
      </TabBar>
    )
  }
}

Nav.propTypes = {
  dispatch: React.PropTypes.func.isRequired,
  tabbedRouter: React.PropTypes.object.isRequired,
  store: React.PropTypes.object.isRequired
}

const styles = StyleSheet.create({
  tabContent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  }
})

export default Nav
