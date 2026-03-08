import {smallHeight, largeHeight} from './list-item'
import type {Props} from './list'

export function useListProps<T>(p: Props<T>) {
  const {items, renderItem, itemHeight, onEndReached, keyProperty, estimatedItemHeight, extraData: extraDataProp, selectedIndex} = p

  const legendRenderItem = ({item, index}: {item: T; index: number}) => {
    return renderItem(index, item)
  }

  const keyExtractor = keyProperty
    ? (item: T, _index: number) => String((item as Record<string, unknown>)[keyProperty])
    : (_item: T, index: number) => String(index)

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

  const recycleItems = itemHeight.type === 'fixed' || itemHeight.type === 'fixedListItemAuto'

  return {
    data: items as T[],
    empty: items.length === 0,
    estimatedItemSize,
    extraData: extraDataProp ?? selectedIndex,
    getFixedItemSize,
    keyExtractor,
    onEndReached: onEndReached ? () => onEndReached() : undefined,
    recycleItems,
    renderItem: legendRenderItem,
  }
}
