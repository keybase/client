import type * as React from 'react'
import type {CustomStyles} from '@/styles'
import type {LegendListRef as _LegendListRef} from '@legendapp/list/react'

export type LegendListState = {
  end: number
  scroll: number
  start: number
}

export type LegendListRef = _LegendListRef & {
  getState: () => LegendListState
}

// List differs from list in that on desktop it uses LegendList.

export type VariableItemHeight<Item> = {
  getItemLayout: (
    index: number,
    item?: Item
  ) => {
    index: number
    length: number
    offset: number
  }
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

// Having flex in the list messes with creating the right size inner container
// for scroll
export type Props<Item> = {
  style?: CustomStyles<'flex' | 'flexDirection'>
  indexAsKey?: boolean
  keyProperty?: string // if passed uses item[keyProperty] for the item keys,
  keyExtractor?: (item: Item, index: number) => string
  items: ReadonlyArray<Item>
  renderItem: (index: number, item: Item) => React.ReactElement | null
  itemHeight: VariableItemHeight<Item> | FixedHeight | FixedListItemAuto | TrueVariable | PerItemHeight<Item>
  estimatedItemHeight?: number
  selectedIndex?: number // TODO,
  bounces?: boolean // mobile only,
  keyboardShouldPersistTaps?: 'never' | 'always' | 'handled' // mobile only,
  windowSize?: number // Mobile only, has a non-RN default,
  onEndReached?: () => void
  reAnimated?: boolean // mobile only, make list animated
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

export declare function List<Item>(p: Props<Item>): React.ReactNode
export default List
