// @flow
import React, {Component} from 'react'
import {requireNativeComponent} from 'react-native'

const tabBarProps = {
  name: 'TabBar',
}

class TabBarItem extends Component {
  render() {
    return this.props.children
  }
}

const NativeTabBar = requireNativeComponent('TabBar', tabBarProps, {
  nativeOnly: {
    onSelect: true,
    // Silence RN's warnings for missing nativeProps
    // TODO remove this when react stops complaining
    rotation: true,
    scaleX: true,
    scaleY: true,
    translateX: true,
    translateY: true,
  },
})

export default class TabBar extends Component {
  shouldComponentUpdate(nextProps: any, nextState: any) {
    // If the titles are the same, then we aren't going to rerender.
    const oldTabs = this.props.children
    const newTabs = nextProps.children
    const oldTitles = oldTabs.map(t => t.props.title)
    const newTitles = newTabs.map(t => t.props.title)
    if (oldTitles.length !== newTitles.length) {
      return true
    }

    oldTitles.forEach((oldTitle, i) => {
      if (oldTitle !== newTitles[i]) {
        return true
      }
    })
    return false
  }

  render() {
    const tabs = this.props.children
    const titles = tabs.map(t => t.props.title)
    const selectedStates = tabs.map(t => t.props.selected || false)
    return (
      <NativeTabBar
        titles={titles}
        selectedStates={selectedStates}
        onSelect={e => {
          const selectedTab = tabs[e.nativeEvent.selectedTab]
          if (selectedTab != null && selectedTab.props.onPress) {
            selectedTab.props.onPress()
          }
        }}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        }}
      >
        {this.props.children}
      </NativeTabBar>
    )
  }
}

// $FlowIssue
TabBar.Item = TabBarItem
