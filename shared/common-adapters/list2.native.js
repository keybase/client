// @flow
import React, {PureComponent} from 'react'
import {FlatList, View} from 'react-native'
import {globalStyles, collapseStyles, styleSheetCreate} from '../styles'
import {memoize} from '../util/memoize'

import type {Props} from './list2'

class List2 extends PureComponent<Props<any>, void> {
  static defaultProps = {
    keyboardShouldPersistTaps: 'handled',
  }
  _itemRender = ({item, index}) => {
    return this.props.renderItem(index, item)
  }

  _memoizedOffsetGetter = memoize((data, index) => {
    if (index === 0) {
      return 0
    }
    if (!index) {
      return 0
    }
    // $FlowIssue can't figure out type for data.
    return this._memoizedOffsetGetter(index - 1) + this.props.itemHeight(index, data[index])
  })

  _getItemLayout = (data, index) => {
    if (typeof this.props.itemHeight === 'number') {
      return {
        index,
        length: this.props.itemHeight,
        offset: this.props.itemHeight * index,
      }
    }
    return {
      index,
      length: this.props.itemHeight(index, data[index]),
      offset: this._memoizedOffsetGetter(data, index),
    }
  }

  _keyExtractor = (item, index: number) => {
    if (this.props.indexAsKey || !item) {
      return String(index)
    }

    const keyProp = this.props.keyProperty || 'key'
    return item[keyProp]
  }

  render() {
    return (
      <View style={collapseStyles([styles.outerView, this.props.style])}>
        {/* need windowSize so iphone 6 doesn't have OOM issues */}
        <View style={globalStyles.fillAbsolute}>
          <FlatList
            bounces={this.props.bounces}
            renderItem={this._itemRender}
            data={this.props.items}
            getItemLayout={this._getItemLayout}
            keyExtractor={this._keyExtractor}
            keyboardShouldPersistTaps={this.props.keyboardShouldPersistTaps}
            onEndReached={this.props.onEndReached}
            windowSize={this.props.windowSize || 10}
            debug={false /* set to true to debug the list */}
          />
        </View>
      </View>
    )
  }
}

const styles = styleSheetCreate({
  outerView: {
    flexGrow: 1,
    position: 'relative',
  },
})

export default List2
