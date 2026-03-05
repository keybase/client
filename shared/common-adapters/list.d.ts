import type * as React from 'react'
import type {CustomStyles} from '@/styles'
import type {LegendListRef} from '@legendapp/list/react'

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

// Having flex in the list messes with creating the right size inner container
// for scroll
export type Props<Item> = {
  style?: CustomStyles<'flex' | 'flexDirection'>
  indexAsKey?: boolean
  keyProperty?: string // if passed uses item[keyProperty] for the item keys,
  items: ReadonlyArray<Item>
  renderItem: (index: number, item: Item) => React.ReactElement | null
  itemHeight: VariableItemHeight<Item> | FixedHeight | FixedListItemAuto | TrueVariable
  estimatedItemHeight?: number
  selectedIndex?: number // TODO,
  bounces?: boolean // mobile only,
  keyboardShouldPersistTaps?: 'never' | 'always' | 'handled' // mobile only,
  windowSize?: number // Mobile only, has a non-RN default,
  onEndReached?: () => void
  reAnimated?: boolean // mobile only, make list animated
  desktopRef?: React.Ref<LegendListRef>
  testID?: string
}

export declare function List<Item>(p: Props<Item>): React.ReactNode
export default List
