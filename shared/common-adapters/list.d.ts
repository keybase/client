import type * as React from 'react'
import type {StylesCrossPlatform} from '@/styles'

export type Props<Item> = {
  bounces?: boolean // mobile only
  indexAsKey?: boolean
  items: ReadonlyArray<Item>
  style?: StylesCrossPlatform
  contentContainerStyle?: StylesCrossPlatform
  fixedHeight?: number
  renderItem: (index: number, item: Item) => React.ReactElement
  keyProperty?: string // if passed uses item[keyProperty] for the item keys
  selectedIndex?: number // TODO work on mobile
  itemSizeEstimator?: (index: number, cache: {[K in number]: number}) => number // Desktop only
  keyboardShouldPersistTaps?: 'never' | 'always' | 'handled' // mobile only
  windowSize?: number // Mobile only, has a non-RN default
  onEndReached?: () => void
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement
  onEndReachedThreshold?: number // mobile only
  onScroll?: (e: unknown) => void // mobile only
  reAnimated?: boolean // mobile only, make list animated
}

/**
 * Semi deprecated. Use list2 if your items are a fixed height
 */
declare function List<Item>(p: Props<Item>): React.ReactNode
export default List
