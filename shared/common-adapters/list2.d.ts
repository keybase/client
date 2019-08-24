import * as React from 'react'
import {StylesCrossPlatformWithSomeDisallowed} from '../styles'

// List2 differs from list in that on desktop it uses react-window.
// Don't use List2 if you need a list with dynamic item sizes

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

export type FixedListItem2Auto = {
  sizeType: 'Small' | 'Large'
  type: 'fixedListItem2Auto'
}

// Having flex in the list messes with creating the right size inner container
// for scroll
type DisallowedStyles = {
  flex?: never
  flexDirection?: never
}

export type Props<Item> = {
  style?: StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>
  indexAsKey?: boolean
  keyProperty?: string // if passed uses item[keyProperty] for the item keys,
  items: Array<Item>
  renderItem: (index: number, item: Item) => React.ReactElement | null
  itemHeight: VariableItemHeight<Item> | FixedHeight | FixedListItem2Auto
  estimatedItemHeight?: number
  selectedIndex?: number // TODO,
  bounces?: boolean // mobile only,
  keyboardShouldPersistTaps?: 'never' | 'always' | 'handled' // mobile only,
  windowSize?: number // Mobile only, has a non-RN default,
  onEndReached?: () => void
}

export default class List2<Item> extends React.Component<Props<Item>> {}
