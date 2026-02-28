import * as React from 'react'
import {FlatList, View} from 'react-native'
import * as Styles from '@/styles'
import type {Props} from './list'
import ReAnimated from './reanimated'
import noop from 'lodash/noop'

const AnimatedFlatList = ReAnimated.FlatList

const List = <Item,>(props: Props<Item>) => {
  const {renderItem, fixedHeight, indexAsKey, keyProperty} = props
  const _itemRender = React.useCallback(
    ({item, index}: {item: Item; index: number}) => {
      return renderItem(index, item)
    },
    [renderItem]
  )

  const _getItemLayout = React.useCallback(
    (_: unknown, index: number) => ({
      index,
      length: fixedHeight || 0,
      offset: (fixedHeight || 0) * index,
    }),
    [fixedHeight]
  )

  const _keyExtractor = React.useCallback(
    (item: Item, index: number) => {
      if (indexAsKey || !item) {
        return String(index)
      }

      const keyProp = keyProperty || 'key'
      const i = item as {[key: string]: string}
      return i[keyProp] ?? String(index)
    },
    [indexAsKey, keyProperty]
  )

  const ListComponent = props.reAnimated ? AnimatedFlatList : FlatList

  return (
    <View style={Styles.collapseStyles([styles.outerView, props.style])}>
      {/* need windowSize so iphone 6 doesn't have OOM issues */}
      {/* We can use initialScrollIndex={this.props.fixedHeight ? this.props.selectedIndex : undefined}                                                                                   ..
        in FlatList below to pass through selectedIndex. However, it has undesirable behavior when the
        selectedIndex is near the end of the list, as it'll then put that index in the center, adding gray
        rows below, and a touch will cause it to 'snap back' so that the end of the list is at the bottom. */}

      <View style={Styles.globalStyles.fillAbsolute}>
        <ListComponent
          overScrollMode="never"
          onScrollToIndexFailed={noop}
          bounces={props.bounces}
          contentContainerStyle={props.contentContainerStyle}
          keyboardDismissMode={props.keyboardDismissMode ?? 'on-drag'}
          renderItem={_itemRender}
          data={props.items}
          getItemLayout={props.fixedHeight ? _getItemLayout : undefined}
          keyExtractor={_keyExtractor}
          keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'}
          ListHeaderComponent={props.ListHeaderComponent}
          onEndReached={props.onEndReached}
          onEndReachedThreshold={props.onEndReachedThreshold}
          windowSize={props.windowSize || 10}
          debug={false /* set to true to debug the list */}
          onScroll={props.onScroll}
        />
      </View>
    </View>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  outerView: {
    flexGrow: 1,
    position: 'relative',
  },
}))

export default List
