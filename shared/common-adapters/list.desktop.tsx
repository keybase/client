import * as React from 'react'
import * as Styles from '@/styles'
import {List as ReactWindowList, type RowComponentProps} from 'react-window'
import type {Props} from './list'
import {smallHeight, largeHeight} from './list-item'

const Row = React.memo(function Row(
  p: RowComponentProps<{
    items: ReadonlyArray<unknown>
    renderItem: (index: number, item: unknown) => React.ReactElement | null
  }>
) {
  const {index, style, items, renderItem} = p
  const item = items[index]
  return item ? <div style={style}>{renderItem(index, item)}</div> : <div style={style} />
}) as (
  props: RowComponentProps<{
    items: ReadonlyArray<unknown>
    renderItem: (index: number, item: unknown) => React.ReactElement | null
  }>
) => React.ReactElement

function List<T>(props: Props<T>) {
  const {items, renderItem, style, itemHeight} = props

  // Need to pass in itemData to make items re-render on prop changes.
  const _fixed = (p: {itemHeight: number}) => {
    const {itemHeight} = p
    return (
      <ReactWindowList
        listRef={props.desktopRef as any}
        style={
          {
            height: '100%',
            overflowY: 'auto',
            scrollbarGutter: 'stable',
            width: '100%',
            ...Styles.castStyleDesktop(style),
          } as const
        }
        rowCount={items.length}
        rowProps={{
          items,
          renderItem: renderItem as (index: number, item: unknown) => React.ReactElement | null,
        }}
        rowHeight={itemHeight}
        rowComponent={Row}
      />
    )
  }

  const _variableItemSize = (index: number, data: {items: ReadonlyArray<unknown>}) => {
    const {items} = data
    return itemHeight.type === 'variable' ? itemHeight.getItemLayout(index, items[index] as T).length : 0
  }

  if (items.length === 0) return null
  switch (props.itemHeight.type) {
    case 'fixed':
      return _fixed({itemHeight: props.itemHeight.height})
    case 'fixedListItemAuto': {
      const itemHeight = props.itemHeight.sizeType === 'Large' ? largeHeight : smallHeight
      return _fixed({itemHeight})
    }
    case 'trueVariable':
      return (
        <ReactWindowList
          listRef={props.desktopRef as any}
          style={
            {
              height: '100%',
              overflowY: 'auto',
              scrollbarGutter: 'stable',
              width: '100%',
              ...Styles.castStyleDesktop(style),
            } as const
          }
          rowCount={items.length}
          rowProps={{
            items,
            renderItem: renderItem as (index: number, item: unknown) => React.ReactElement | null,
          }}
          rowHeight={props.itemHeight.rowHeight}
          rowComponent={Row}
        />
      )
    case 'variable':
      return (
        <ReactWindowList
          listRef={props.desktopRef as any}
          style={
            {
              height: '100%',
              overflowY: 'auto',
              scrollbarGutter: 'stable',
              width: '100%',
              ...Styles.castStyleDesktop(style),
            } as const
          }
          rowCount={items.length}
          rowProps={{
            items,
            renderItem: renderItem as (index: number, item: unknown) => React.ReactElement | null,
          }}
          rowHeight={_variableItemSize}
          rowComponent={Row}
        />
      )
    default:
      return <></>
  }
}

export default List
