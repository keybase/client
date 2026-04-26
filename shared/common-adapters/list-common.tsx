import {smallHeight, largeHeight} from './list-item'
import type {Props} from './list'

export function useListProps<T>(p: Props<T>) {
  const {
    items,
    renderItem,
    itemHeight,
    onEndReached,
    keyProperty,
    estimatedItemHeight,
    extraData: extraDataProp,
    selectedIndex,
    ListHeaderComponent,
    ListFooterComponent,
    recycleItems: recycleItemsOverride,
  } = p
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
        ? itemHeight.sizeType === 'Large'
          ? largeHeight
          : smallHeight
        : 48)

  const recycleItems =
    recycleItemsOverride ??
    (itemHeight.type === 'fixed' || itemHeight.type === 'fixedListItemAuto' || itemHeight.type === 'perItem')

  return {
    data: items as T[],
    empty: items.length === 0,
    estimatedItemSize,
    extraData: extraDataProp ?? selectedIndex,
    keyExtractor,
    recycleItems,
    renderItem: legendRenderItem,
    ...(ListFooterComponent === undefined ? {} : {ListFooterComponent}),
    ...(ListHeaderComponent === undefined ? {} : {ListHeaderComponent}),
    ...(drawDistance === undefined ? {} : {drawDistance}),
    ...(getFixedItemSize === undefined ? {} : {getFixedItemSize}),
    ...(getItemType === undefined ? {} : {getItemType}),
    ...(onEndReached === undefined ? {} : {onEndReached: () => onEndReached()}),
    ...(onViewableItemsChanged === undefined ? {} : {onViewableItemsChanged: onViewableItemsChanged as any}),
    ...(viewabilityConfig === undefined ? {} : {viewabilityConfig}),
  }
}
