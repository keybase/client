import * as React from 'react'
import * as Styles from '@/styles'
import {List, type RowComponentProps} from 'react-window'
import type {Props} from './list2'
import {smallHeight, largeHeight} from './list-item2'

const Row = React.memo(function Row(
  p: RowComponentProps<{
    items: ReadonlyArray<unknown>
    renderItem: (index: number, item: unknown) => React.ReactElement | null
  }>
) {
  const {index, style, items, renderItem} = p
  const item = items[index]
  return item ? <div style={style}>{renderItem(index, item)}</div> : null
})

function List2<T>(props: Props<T>) {
  const {items, renderItem} = props
  const {style, itemHeight} = props

  // Need to pass in itemData to make items re-render on prop changes.
  const _fixed = (p: {itemHeight: number}) => {
    const {itemHeight} = p
    return (
      <List
        style={
          {
            height: '100%',
            overflowY: 'scroll',
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
    case 'fixedListItem2Auto': {
      const itemHeight = props.itemHeight.sizeType === 'Large' ? largeHeight : smallHeight
      return _fixed({itemHeight})
    }
    case 'variable':
      return (
        <List
          style={
            {
              height: '100%',
              overflowY: 'scroll',
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

export default List2
