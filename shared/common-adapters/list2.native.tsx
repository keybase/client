import * as React from 'react'
import {FlatList, View} from 'react-native'
import * as Styles from '@/styles'
import {smallHeight, largeHeight} from './list-item2'
import ReAnimated from './reanimated'
import type {Props} from './list2'
import noop from 'lodash/noop'

const AnimatedFlatList = ReAnimated.FlatList

const List2 = React.memo(function List2<T>(p: Props<T>) {
  const {indexAsKey, keyProperty, itemHeight, renderItem, ...props} = p

  const itemRender = React.useCallback(
    ({item, index}: {item: T; index: number}) => {
      return renderItem(index, item)
    },
    [renderItem]
  )

  const getItemLayout = React.useCallback(
    (data: ArrayLike<T> | null | undefined, index: number) => {
      switch (itemHeight.type) {
        case 'fixed':
          return {index, length: itemHeight.height, offset: itemHeight.height * index}
        case 'fixedListItem2Auto': {
          const length = itemHeight.sizeType === 'Large' ? largeHeight : smallHeight
          return {index, length, offset: length * index}
        }
        case 'variable':
          return {...itemHeight.getItemLayout(index, data ? data[index] : undefined)}
        default:
          return {index, length: 0, offset: 0}
      }
    },
    [itemHeight]
  )

  const keyExtractor = React.useCallback(
    (item: T, index: number) => {
      if (indexAsKey || !item) {
        return String(index)
      }

      const keyProp = keyProperty || 'key'
      const i: {[key: string]: string} = item
      return i[keyProp] ?? String(index)
    },
    [indexAsKey, keyProperty]
  )

  const List = props.reAnimated ? AnimatedFlatList : FlatList
  return (
    <View style={styles.outerView}>
      {/* need windowSize so iphone 6 doesn't have OOM issues */}
      <List
        overScrollMode="never"
        bounces={p.bounces}
        renderItem={itemRender}
        data={p.items}
        getItemLayout={(data: ArrayLike<T> | null | undefined, index: number) => getItemLayout(data, index)}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'}
        onEndReached={props.onEndReached}
        windowSize={props.windowSize || 10}
        debug={false /* set to true to debug the list */}
        contentContainerStyle={props.style}
        onScrollToIndexFailed={noop}
      />
    </View>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      outerView: {
        flexGrow: 1,
        position: 'relative',
      },
    }) as const
)

export default List2
