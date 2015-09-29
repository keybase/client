'use strict'

import React, { requireNativeComponent, PropTypes } from 'react-native'
const {
  Component
} = React

class TabBar extends Component {
  constructor (props) {
    super(props)
  }

  render () {
    return (
      <NativeTabBar/>
    )
  }
}

TabBar.propTypes = {
  placeholderprop: PropTypes.string
}

const NativeTabBar = requireNativeComponent('TabBar', TabBar)
export default NativeTabBar
