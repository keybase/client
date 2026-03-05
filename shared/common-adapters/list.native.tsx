import {View} from 'react-native'
import * as Styles from '@/styles'
import {smallHeight, largeHeight} from './list-item'
import {LegendList} from '@legendapp/list/react-native'
import type {LegendListRenderItemProps} from '@legendapp/list/react-native'
import type {Props} from './list'

function List<T>(p: Props<T>) {
  const {items, renderItem, itemHeight, onEndReached, keyProperty, indexAsKey, estimatedItemHeight} = p

  const legendRenderItem = ({item, index}: LegendListRenderItemProps<T>) => {
    return renderItem(index, item)
  }

  const keyExtractor = keyProperty
    ? (item: T, _index: number) => String((item as Record<string, unknown>)[keyProperty])
    : indexAsKey
      ? (_item: T, index: number) => String(index)
      : undefined

  const getFixedItemSize =
    itemHeight.type === 'fixed'
      ? () => itemHeight.height
      : itemHeight.type === 'fixedListItemAuto'
        ? () => (itemHeight.sizeType === 'Large' ? largeHeight : smallHeight)
        : itemHeight.type === 'variable'
          ? (item: T, index: number) => itemHeight.getItemLayout(index, item).length
          : undefined

  const estimatedItemSize =
    estimatedItemHeight ??
    (itemHeight.type === 'fixed'
      ? itemHeight.height
      : itemHeight.type === 'fixedListItemAuto'
        ? (itemHeight.sizeType === 'Large' ? largeHeight : smallHeight)
        : 48)

  if (items.length === 0) return null

  return (
    <View style={styles.outerView}>
      <LegendList
        data={items as T[]}
        renderItem={legendRenderItem}
        keyExtractor={keyExtractor}
        getFixedItemSize={getFixedItemSize}
        estimatedItemSize={estimatedItemSize}
        extraData={renderItem}
        onEndReached={onEndReached ? () => onEndReached() : undefined}
        recycleItems={itemHeight.type === 'fixed' || itemHeight.type === 'fixedListItemAuto'}
        keyboardShouldPersistTaps={p.keyboardShouldPersistTaps ?? 'handled'}
        overScrollMode="never"
        bounces={p.bounces}
        contentContainerStyle={p.style}
      />
    </View>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      outerView: {
        flexGrow: 1,
        position: 'relative',
      },
    }) as const
)

export default List
