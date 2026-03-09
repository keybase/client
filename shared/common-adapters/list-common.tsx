import {smallHeight, largeHeight} from './list-item'
import type {Props} from './list'

export function useListProps<T>(p: Props<T>) {
  const {items, renderItem, itemHeight, onEndReached, keyProperty, estimatedItemHeight, extraData: extraDataProp, selectedIndex, ListHeaderComponent, ListFooterComponent, recycleItems: recycleItemsOverride} = p
  const {getItemType, drawDistance, onViewableItemsChanged, viewabilityConfig} = p

  const legendRenderItem = ({item, index}: {item: T; index: number}) => {
    return renderItem(index, item)
  }

  const keyExtractor = p.keyExtractor
    ? p.keyExtractor
    : keyProperty
      ? (item: T, _index: number) => String((item as Record<string, unknown>)[keyProperty])
      : (_item: T, index: number) => String(index)

  const getFixedItemSize =
    itemHeight.type === 'fixed'
      ? () => itemHeight.height
      : itemHeight.type === 'fixedListItemAuto'
        ? () => (itemHeight.sizeType === 'Large' ? largeHeight : smallHeight)
        : itemHeight.type === 'variable'
          ? (item: T, index: number) => itemHeight.getItemLayout(index, item).length
          : itemHeight.type === 'perItem'
            ? (item: T) => itemHeight.getSize(item)
            : undefined

  const estimatedItemSize =
    estimatedItemHeight ??
    (itemHeight.type === 'fixed'
      ? itemHeight.height
      : itemHeight.type === 'fixedListItemAuto'
        ? (itemHeight.sizeType === 'Large' ? largeHeight : smallHeight)
        : 48)

  const recycleItems = recycleItemsOverride ?? (itemHeight.type === 'fixed' || itemHeight.type === 'fixedListItemAuto' || itemHeight.type === 'perItem')

  return {
    ListFooterComponent,
    ListHeaderComponent,
    data: items as T[],
    drawDistance,
    empty: items.length === 0,
    estimatedItemSize,
    extraData: extraDataProp ?? selectedIndex,
    getFixedItemSize,
    getItemType,
    keyExtractor,
    onEndReached: onEndReached ? () => onEndReached() : undefined,
    onViewableItemsChanged: onViewableItemsChanged as any,
    recycleItems,
    renderItem: legendRenderItem,
    viewabilityConfig,
  }
}
