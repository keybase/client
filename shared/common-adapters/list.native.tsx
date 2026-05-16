import {View} from 'react-native'
import * as Styles from '@/styles'
import {LegendList} from '@legendapp/list/react-native'
import type {LegendListRef as _LegendListRef} from '@legendapp/list/react'
import {useListProps} from '@/common-adapters/list-common'
import type {FixedHeight, FixedListItemAuto, LegendListRef, TrueVariable} from '@/common-adapters/list.shared'


export type VariableItemHeight<Item> = {
  getItemLayout: (index: number, item?: Item) => {index: number; length: number; offset: number}
  type: 'variable'
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
  if (empty) return null

  return (
    <View style={styles.outerView}>
      <LegendList
        ref={ref as any}
        {...listProps}
        testID={p.testID}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps={p.keyboardShouldPersistTaps ?? 'handled'}
        overScrollMode="never"
        bounces={p.bounces}
        contentContainerStyle={p.style}
      />
    </View>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      outerView: {
        flexGrow: 1,
        position: 'relative',
      },
    }) as const
)

export default List

export type * from '@/common-adapters/list.shared'
