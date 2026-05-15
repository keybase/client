import type {CSSProperties} from 'react'
import * as Styles from '@/styles'
import {LegendList} from '@legendapp/list/react'
import type {LegendListRef as _LegendListRef} from '@legendapp/list/react'
import {useListProps} from './list-common'


export type LegendListState = {
  end: number
  scroll: number
  scrollLength: number
  start: number
}

export type LegendListRef = _LegendListRef & {
  getState: () => LegendListState
}

export type VariableItemHeight<Item> = {
  getItemLayout: (index: number, item?: Item) => {index: number; length: number; offset: number}
  type: 'variable'
}

export type FixedHeight = {
  height: number
  type: 'fixed'
}

export type FixedListItemAuto = {
  sizeType: 'Small' | 'Large'
  type: 'fixedListItemAuto'
}

export type TrueVariable = {
  type: 'trueVariable'
}

export type PerItemHeight<Item> = {
  type: 'perItem'
  getSize: (item: Item) => number
}

export type ViewableItem<Item> = {index: number; item: Item}

export type Props<Item> = {
  style?: Styles.CustomStyles<'flex' | 'flexDirection'>
  indexAsKey?: boolean
  keyProperty?: string
  keyExtractor?: (item: Item, index: number) => string
  items: ReadonlyArray<Item>
  renderItem: (index: number, item: Item) => React.ReactElement | null
  itemHeight: VariableItemHeight<Item> | FixedHeight | FixedListItemAuto | TrueVariable | PerItemHeight<Item>
  estimatedItemHeight?: number
  selectedIndex?: number
  bounces?: boolean
  keyboardShouldPersistTaps?: 'never' | 'always' | 'handled'
  windowSize?: number
  onEndReached?: () => void
  reAnimated?: boolean
  extraData?: unknown
  ref?: React.Ref<LegendListRef>
  testID?: string
  ListHeaderComponent?: React.ComponentType<unknown> | React.ReactElement | null
  ListFooterComponent?: React.ComponentType<unknown> | React.ReactElement | null
  recycleItems?: boolean
  getItemType?: (item: Item, index: number) => string | undefined
  drawDistance?: number
  onViewableItemsChanged?: (data: {
    viewableItems: ReadonlyArray<ViewableItem<Item>>
    changed: ReadonlyArray<ViewableItem<Item>>
  }) => void
  viewabilityConfig?: object
}
function List<T>({ref, ...p}: Props<T>) {
  const {empty, ...listProps} = useListProps(p as Props<T>)
  const {style} = p
  if (empty) return null

  return (
    <LegendList
      ref={ref as any}
      {...listProps}
      style={
        {
          height: '100%',
          outline: 'none',
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
