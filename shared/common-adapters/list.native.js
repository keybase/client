// @flow
import React, {PureComponent} from 'react'
import {FlatList, View} from 'react-native'
import {globalStyles, collapseStyles, styleSheetCreate} from '../styles'

import type {Props} from './list'

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
      <View style={collapseStyles([styles.outerView, this.props.style])}>
        {/* need windowSize so iphone 6 doesn't have OOM issues */}
        {/* We can use
            initialScrollIndex={this.props.fixedHeight ? this.props.selectedIndex : undefined}
          in FlatList below to pass through selectedIndex. However, it
          has undesirable behavior when the selectedIndex is near the end of
          the list, as it'll then put that index in the center, adding gray
          rows below, and a touch will cause it to 'snap back' so that the
          end of the list is at the bottom.
       */}
        <View style={globalStyles.fillAbsolute}>
          <FlatList
            bounces={this.props.bounces}
            renderItem={this._itemRender}
            data={this.props.items}
            getItemLayout={this.props.fixedHeight ? this._getItemLayout : undefined}
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

export default List
