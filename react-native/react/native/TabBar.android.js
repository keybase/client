'use strict'

import React, { requireNativeComponent, PropTypes } from 'react-native'
const {
  Component
} = React

const tabBarProps = {
  name: 'TabBar',
  propTypes: {
    titles: PropTypes.array,
    selectedStates: PropTypes.array
  }
}

class TabBarItem extends Component {
  constructor (props) {
    super(props)
  }

  render () {
    return this.props.children
  }
}

TabBarItem.propTypes = {
  title: PropTypes.string.isRequired,
  selected: PropTypes.bool.isRequired,
  onPress: PropTypes.func.isRequired,
  children: PropTypes.element.isRequired
}

const NativeTabBar = requireNativeComponent(
  'TabBar',
  tabBarProps,
  {nativeOnly: {onSelect: true}}
)

class TabBar extends Component {
  constructor (props) {
    super(props)
  }

  render () {
    const tabs = this.props.children
    const titles = tabs.map((t) => t.props.title)
    const selectedStates = tabs.map((t) => (t.props.selected || false))
    return (
      <NativeTabBar
        titles={titles}
        selectedStates={selectedStates}
        onSelect={(e) => {
          const selectedTab = tabs[e.nativeEvent.selectedTab]
          if (selectedTab != null && selectedTab.props.onPress) {
            selectedTab.props.onPress()
          }
        }}
        style={{position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0}}>
        {this.props.children}
      </NativeTabBar>
    )
  }
}

TabBar.propTypes = {
  children: PropTypes.array.isRequired
}

TabBar.Item = TabBarItem

export default TabBar
