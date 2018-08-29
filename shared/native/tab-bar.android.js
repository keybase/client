// @flow
import React, {Component} from 'react'
import {requireNativeComponent} from 'react-native'
import * as Styles from '../styles'

const NativeTabBar = requireNativeComponent('TabBar', null)

export default class TabBar extends Component<any, any> {
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

  _onSelect = e => {
    const tabs = this.props.children
    const selectedTab = tabs[e.nativeEvent.selectedTab]
    if (selectedTab != null && selectedTab.props.onPress) {
      selectedTab.props.onPress()
    }
  }

  render() {
    const tabs = this.props.children
    const titles = tabs.map(t => t.props.title)
    const selectedStates = tabs.map(t => t.props.selected || false)
    return (
      <NativeTabBar
        titles={titles}
        selectedStates={selectedStates}
        onSelect={this._onSelect}
        style={styles.tabBar}
      >
        {this.props.children}
      </NativeTabBar>
    )
  }
}

const styles = Styles.styleSheetCreate({
  tabBar: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
})
