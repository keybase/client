'use strict'

import React, { Component, TabBarIOS } from 'react-native'
import SwiftTest from './swift-test'
import GoTest from './go-test'
import ReactTest from './react-test'
import ObjcTest from './objc-test'

export default class Bridging extends Component {
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
          systemIcon='bookmarks'
          onPress={() => this.onSwitchTab('react')}
          >
          <ReactTest/>
        </TabBarIOS.Item>

        <TabBarIOS.Item
          title='Objc'
          selected={this.isSelected('objc')}
          systemIcon='bookmarks'
          onPress={() => this.onSwitchTab('objc')}
          >
          <ObjcTest/>
        </TabBarIOS.Item>

        <TabBarIOS.Item
          title='Swift'
          selected={this.isSelected('swift')}
          systemIcon='bookmarks'
          onPress={() => this.onSwitchTab('swift')}
          >
          <SwiftTest/>
        </TabBarIOS.Item>

        <TabBarIOS.Item
          title='Go'
          selected={this.isSelected('go')}
          systemIcon='bookmarks'
          onPress={() => this.onSwitchTab('go')}
          >
          <GoTest/>
        </TabBarIOS.Item>

      </TabBarIOS>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Bridging'
      }
    }
  }
}
