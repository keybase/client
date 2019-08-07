import React, {PureComponent} from 'react'
import {FlatList, View} from 'react-native'
import {globalStyles, collapseStyles, styleSheetCreate} from '../styles'

import {Props} from './list'

class List<Item> extends PureComponent<Props<Item>> {
  static defaultProps = {
    keyboardShouldPersistTaps: 'handled',
  }
  _itemRender = ({item, index}: {item: Item; index: number}) => {
    return this.props.renderItem(index, item)
  }

  _getItemLayout = (_: Array<Item> | null, index: number) => ({
    index,
    length: this.props.fixedHeight || 0,
    offset: (this.props.fixedHeight || 0) * index,
  })

  _keyExtractor = (item: Item, index: number) => {
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
            // @ts-ignore TODO styles
            contentContainerStyle={this.props.contentContainerStyle}
            renderItem={this._itemRender}
            data={this.props.items}
            getItemLayout={this.props.fixedHeight ? this._getItemLayout : undefined}
            keyExtractor={this._keyExtractor}
            keyboardShouldPersistTaps={this.props.keyboardShouldPersistTaps}
            ListHeaderComponent={this.props.ListHeaderComponent}
            onEndReached={this.props.onEndReached}
            onEndReachedThreshold={this.props.onEndReachedThreshold}
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
