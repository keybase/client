// @flow
import React, {PureComponent} from 'react'
import {FlatList, View} from 'react-native'
import {globalStyles} from '../styles'

type Props<Item> = {
  indexAsKey?: boolean,
  items: Array<Item>,
  style?: any,
  fixedHeight?: ?number,
  renderItem: (index: number, item: Item) => React.Node,
  keyProperty?: string, // if passed uses item[keyProperty] for the item keys (does nothing on desktop)
  selectedIndex?: number, // TODO work on mobile
  itemSizeEstimator?: (index: number, cache: {[index: number]: number}) => number, // Desktop only
  keyboardShouldPersistTaps?: 'never' | 'always' | 'handled', // mobile only
  windowSize?: number, // Mobile only, has a non-RN default
}

class List extends PureComponent<Props<any>, void> {
  static defaultProps = {
    keyboardShouldPersistTaps: 'handled',
  }
  _itemRender = ({item, index}) => {
    return this.props.renderItem(index, item)
  }

  _getItemLayout = (data, index) => ({
    index,
    length: this.props.fixedHeight || 0,
    offset: (this.props.fixedHeight || 0) * index,
  })

  _keyExtractor = (item, index: number) => {
    if (this.props.indexAsKey || !item) {
      return String(index)
    }

    const keyProp = this.props.keyProperty || 'key'
    return item[keyProp]
  }

  render() {
    return (
      <View
        style={{
          flexGrow: 1,
          position: 'relative',
          ...this.props.style,
        }}
      >
        {/* need windowSize so iphone 6 doesn't have OOM issues */}
        <View style={globalStyles.fillAbsolute}>
          <FlatList
            renderItem={this._itemRender}
            data={this.props.items}
            getItemLayout={this.props.fixedHeight ? this._getItemLayout : undefined}
            keyExtractor={this._keyExtractor}
            keyboardShouldPersistTaps={this.props.keyboardShouldPersistTaps}
            windowSize={this.props.windowSize || 10}
            debug={false /* set to true to debug the list */}
          />
        </View>
      </View>
    )
  }
}

export default List
