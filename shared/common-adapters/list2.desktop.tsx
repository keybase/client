import * as React from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import {List} from 'react-window'
import type {Props} from './list2'
import {smallHeight, largeHeight} from './list-item2'

type RowData<T> = {items: Props<T>['items']; renderItem: Props<T>['renderItem']}
type RowProps<T> = {data: RowData<T>; index: number; style: React.CSSProperties}
const Row = React.memo(function Row<T>(p: RowProps<T>) {
  const {index, style, data} = p
  const {items, renderItem} = data
  const item = items[index]
  return item ? <div style={style}>{renderItem(index, item)}</div> : null
}) as <T>(p: RowProps<T>) => React.ReactElement | null

const List2 = <T,>(props: Props<T>) => {
  const {items, indexAsKey, keyProperty, renderItem, estimatedItemHeight} = props
  const {style, itemHeight, forceLayout} = props
  const variableSizeListRef = React.useRef<List>(null)

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
    (p: {height: number; width: number; itemHeight: number}) => {
      const {height, width, itemHeight} = p
      return (
        <List<RowData<T>>
          style={style as React.CSSProperties}
          height={height}
          width={width}
          itemCount={items.length}
          itemData={_getItemData()}
          itemKey={_keyExtractor}
          itemSize={itemHeight}
        >
          {Row}
        </List>
      )
    },
    [style, items.length, _getItemData, _keyExtractor]
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
          ref={variableSizeListRef}
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

  // TEMP
  return null

  // const lastForceLayoutRef = React.useRef(forceLayout)
  // React.useEffect(() => {
  //   if (lastForceLayoutRef.current !== forceLayout) {
  //     lastForceLayoutRef.current = forceLayout
  //     variableSizeListRef.current?.resetAfterIndex(0, true)
  //   }
  // }, [forceLayout])

  if (items.length === 0) return null
  return (
    <AutoSizer doNotBailOutOnEmptyChildren={true}>
      {(p: {height?: number; width?: number}) => {
        let {height = 1, width = 1} = p
        if (isNaN(height)) {
          height = 1
        }
        if (isNaN(width)) {
          width = 1
        }
        switch (props.itemHeight.type) {
          case 'fixed':
            return _fixed({height, itemHeight: props.itemHeight.height, width})
          case 'fixedListItem2Auto': {
            const itemHeight = props.itemHeight.sizeType === 'Large' ? largeHeight : smallHeight
            return _fixed({height, itemHeight, width})
          }
          case 'variable':
            return _variable({height, width})
          default:
            return <></>
        }
      }}
    </AutoSizer>
  )
}

export default List2
