import * as React from 'react'
import {VirtualizedList, VirtualizedListProps, ViewToken} from 'react-native'

type ExtraProps = {
  // exist in class but not type or docs
  maintainVisibleContentPosition?: {
    minIndexForVisible: number
    autoscrollToTopThreshold?: number
  }
}

class NativeVirtualizedList<ItemT> extends React.Component<VirtualizedListProps<ItemT> & ExtraProps> {
  private mounted = false
  private list = React.createRef<VirtualizedList<ItemT>>()

  componentDidMount() {
    this.mounted = true
  }
  componentWillUnmount() {
    this.mounted = false
  }

  scrollToIndex = (params: {
    animated?: boolean
    index: number
    viewOffset?: number
    viewPosition?: number
  }) => {
    // @ts-ignore actually does exist
    this.list.current && this.list.current.scrollToIndex(params)
  }

  // This can be called while unmounted which causes all sorts of problems: https://github.com/facebook/react-native/issues/21170
  private onViewableItemsChanged = (info: {viewableItems: Array<ViewToken>; changed: Array<ViewToken>}) => {
    if (this.mounted && this.props.onViewableItemsChanged) {
      this.props.onViewableItemsChanged(info)
    }
  }

  render() {
    return <VirtualizedList {...this.props} onViewableItemsChanged={this.onViewableItemsChanged} />
  }
}

export default NativeVirtualizedList
