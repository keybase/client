import type {CSSProperties} from 'react'
import * as Styles from '@/styles'
import {LegendList} from '@legendapp/list/react'
import type {LegendListRenderItemProps} from '@legendapp/list/react'
import type {Props} from './list'
import {smallHeight, largeHeight} from './list-item'

function List<T>(props: Props<T>) {
  const {items, renderItem, style, itemHeight, onEndReached, keyProperty, indexAsKey, estimatedItemHeight, desktopRef} = props

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
    <LegendList
      ref={desktopRef as any}
      data={items as T[]}
      renderItem={legendRenderItem}
      keyExtractor={keyExtractor}
      getFixedItemSize={getFixedItemSize}
      estimatedItemSize={estimatedItemSize}
      extraData={renderItem}
      onEndReached={onEndReached ? () => onEndReached() : undefined}
      recycleItems={itemHeight.type === 'fixed' || itemHeight.type === 'fixedListItemAuto'}
      style={
        {
          height: '100%',
          overflowY: 'auto',
          scrollbarGutter: 'stable',
          width: '100%',
          ...Styles.castStyleDesktop(style),
        } as CSSProperties
      }
    />
  )
}

export default List
