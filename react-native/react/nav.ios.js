'use strict'

import React from 'react-native'
import { connect } from 'react-redux/native'
import MetaNavigator from './router/meta-navigator.js'

import Folders from './tabs/folders'
import Chat from './tabs/chat'
import People from './tabs/people'
import Devices from './tabs/devices'
import NoTab from './tabs/no-tab'
import More from './tabs/more'

import { switchTab } from './actions/tabbedRouter'

import {FOLDER_TAB, CHAT_TAB, PEOPLE_TAB, DEVICES_TAB, MORE_TAB} from './constants/tabs'

const {
  Component,
  TabBarIOS,
  View,
  StyleSheet
} = React

const tabToRootRouteParse = {
  [FOLDER_TAB]: Folders.parseRoute,
  [CHAT_TAB]: Chat.parseRoute,
  [PEOPLE_TAB]: People.parseRoute,
  [DEVICES_TAB]: Devices.parseRoute,
  [MORE_TAB]: More.parseRoute
}

class Nav extends Component {

  _renderContent (color, pageText, num) {
    const activeTab = this.props.tabbedRouter.get('activeTab')
    return (
      <View style={[styles.tabContent, {backgroundColor: color}]}>
        {React.createElement(
          connect(state => state.tabbedRouter.getIn(['tabs', state.tabbedRouter.get('activeTab')]).toObject())(MetaNavigator),
          {store: this.props.store, rootRouteParser: tabToRootRouteParse[activeTab] || NoTab}
        )}
      </View>
    )
  }

  shouldComponentUpdate (nextProps, nextState) {
    const activeTab = this.props.tabbedRouter.get('activeTab')
    const nextActiveTab = nextProps.tabbedRouter.get('activeTab')
    return activeTab !== nextActiveTab
  }

  render () {
    const {dispatch} = this.props
    const activeTab = this.props.tabbedRouter.get('activeTab')
    return (
      <View style={{flex: 1}}>
        <TabBarIOS
          tintColor='black'>
          <TabBarIOS.Item
            title='Folders'
            selected={activeTab === FOLDER_TAB}
            onPress={() => dispatch(switchTab(FOLDER_TAB))}>
            {this._renderContent('#414A8C', 'Blue Tab')}
          </TabBarIOS.Item>
          <TabBarIOS.Item
            title='Chat'
            selected={activeTab === CHAT_TAB}
            onPress={() => dispatch(switchTab(CHAT_TAB))}>
            {this._renderContent('#417A8C', 'Blue Tab')}
          </TabBarIOS.Item>
          <TabBarIOS.Item
            title='People'
            systemIcon='contacts'
            selected={activeTab === PEOPLE_TAB}
            onPress={() => dispatch(switchTab(PEOPLE_TAB))}>
            {this._renderContent('#214A8C', 'Blue Tab')}
          </TabBarIOS.Item>
          <TabBarIOS.Item
            title='Devices'
            selected={activeTab === DEVICES_TAB}
            onPress={() => dispatch(switchTab(DEVICES_TAB))}>
            {this._renderContent('#783E33', 'Red Tab')}
          </TabBarIOS.Item>
          <TabBarIOS.Item
            systemIcon='more'
            selected={activeTab === MORE_TAB}
            onPress={() => dispatch(switchTab(MORE_TAB))}>
            {this._renderContent('#21551C', 'Green Tab')}
          </TabBarIOS.Item>
        </TabBarIOS>
      </View>
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {component: Nav},
      parseNextRoute: null
    }
  }
}

Nav.propTypes = {
  dispatch: React.PropTypes.func.isRequired,
  tabbedRouter: React.PropTypes.object.isRequired,
  store: React.PropTypes.object.isRequired
}

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
    paddingTop: 20
  }
})

export default Nav
