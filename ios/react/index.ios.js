'use strict'

var React = require('react-native')
var {
  AppRegistry,
  Component,
  TabBarIOS
} = React

var SwiftTest = require('./swift-test')
var GoTest = require('./go-test')
var ReactTest = require('./react-test')
var ObjcTest = require('./objc-test')

var tabIcon = {
  uri: 'tab'
}

class Keybase extends Component {
  constructor () {
    super()
    this.state = {
      selectedTab: 'react'
    }
  }

  onSwitchTab (tab) {
    this.setState({
      selectedTab: tab
    })
  }

  isSelected (tab) {
    return this.state.selectedTab === tab
  }

  render () {
    return (
      <TabBarIOS selectedTab={this.state.selectedTab}>

        <TabBarIOS.Item
          title='React'
          selected={this.isSelected('react')}
          icon={tabIcon}
          onPress={() => this.onSwitchTab('react')}
          >
          <ReactTest/>
        </TabBarIOS.Item>

        <TabBarIOS.Item
          title='Objc'
          selected={this.isSelected('objc')}
          icon={tabIcon}
          onPress={() => this.onSwitchTab('objc')}
          >
          <ObjcTest/>
        </TabBarIOS.Item>

        <TabBarIOS.Item
          title='Swift'
          selected={this.isSelected('swift')}
          icon={tabIcon}
          onPress={() => this.onSwitchTab('swift')}
          >
          <SwiftTest/>
        </TabBarIOS.Item>

        <TabBarIOS.Item
          title='Go'
          selected={this.isSelected('go')}
          icon={tabIcon}
          onPress={() => this.onSwitchTab('go')}
          >
          <GoTest/>
        </TabBarIOS.Item>

      </TabBarIOS>
    )
  }
}

AppRegistry.registerComponent('Keybase', () => Keybase)
