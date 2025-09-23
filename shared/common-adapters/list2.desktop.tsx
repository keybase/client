import * as React from 'react'
import * as Styles from '@/styles'
import {List, type RowComponentProps} from 'react-window'
import type {Props} from './list2'
import {smallHeight, largeHeight} from './list-item2'

type RowData<T> = {items: Props<T>['items']; renderItem: Props<T>['renderItem']}
const Row = React.memo(function Row<T>(p: RowComponentProps<RowData<T>>) {
  const {index, style, items, renderItem} = p
  const item = items[index]
  return item ? <div style={style}>{renderItem(index, item)}</div> : null
})

function List2<T>(props: Props<T>) {
  const {items, indexAsKey, keyProperty, renderItem, estimatedItemHeight} = props
  const {style, itemHeight} = props

  const _keyExtractor = React.useCallback(
    (index: number) => {
      const item = items[index]
      if (indexAsKey || !item) {
        return String(index)
      }

      const keyProp = keyProperty || 'key'
      const i: {[key: string]: string} = item
      return i[keyProp] ?? String(index)
    },
    [items, indexAsKey, keyProperty]
  )

  const _getItemDataCached = React.useRef<RowData<T>>(undefined)
  const _getItemData = React.useCallback(() => {
    if (_getItemDataCached.current?.items === items && _getItemDataCached.current.renderItem === renderItem) {
      return _getItemDataCached.current
    }
    const ret = {items, renderItem}
    _getItemDataCached.current = ret
    return ret
  }, [items, renderItem])

  // Need to pass in itemData to make items re-render on prop changes.
  const _fixed = React.useCallback(
    (p: {itemHeight: number}) => {
      const {itemHeight} = p
      return (
        <List
          style={
            {height: '100%', overflowY: 'scroll', width: '100%', ...Styles.castStyleDesktop(style)} as const
          }
          rowCount={items.length}
          rowProps={{items, renderItem}}
          //itemKey={_keyExtractor}
          rowHeight={itemHeight}
          rowComponent={Row}
        />
      )
    },
    [style, items, renderItem]
  )

  const _variableItemSize = React.useCallback(
    (index: number) =>
      itemHeight.type === 'variable' ? itemHeight.getItemLayout(index, items[index]).length : 0,
    [itemHeight, items]
  )

  const _variable = React.useCallback(
    (p: {height: number; width: number}) => {
      const {height, width} = p
      return (
        <List<RowData<T>>
          style={style as React.CSSProperties}
          rowHeight={height}
          width={width}
          rowCount={items.length}
          itemData={_getItemData()}
          itemKey={_keyExtractor}
          itemSize={_variableItemSize}
          estimatedItemSize={estimatedItemHeight}
          rowComponent={Row}
        />
      )
    },
    [style, items.length, _getItemData, _keyExtractor, _variableItemSize, estimatedItemHeight]
  )

  if (items.length === 0) return null
  switch (props.itemHeight.type) {
    case 'fixed':
      return _fixed({itemHeight: props.itemHeight.height})
    case 'fixedListItem2Auto': {
      const itemHeight = props.itemHeight.sizeType === 'Large' ? largeHeight : smallHeight
      return _fixed({itemHeight})
    }
    case 'variable':
      return _variable({})
    default:
      return <></>
  }
}

export default List2
