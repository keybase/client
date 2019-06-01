import * as React from 'react'
import {VirtualizedList} from 'react-native'

class NativeVirtualizedList extends React.Component<React.ComponentProps<VirtualizedList>> {
  _mounted = false

  componentDidMount() {
    this._mounted = true
  }
  componentWillUnmount() {
    this._mounted = false
  }

  // This can be called while unmounted which causes all sorts of problems: https://github.com/facebook/react-native/issues/21170
  _onViewableItemsChanged = info => {
    if (this._mounted && this.props.onViewableItemsChanged) {
      this.props.onViewableItemsChanged(info)
    }
  }

  render() {
    const {forwardedRef, ...rest} = this.props
    return (
      <VirtualizedList {...rest} ref={forwardedRef} onViewableItemsChanged={this._onViewableItemsChanged} />
    )
  }
}

export default NativeVirtualizedList
