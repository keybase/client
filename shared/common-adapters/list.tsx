import type {CSSProperties} from 'react'
import {View} from 'react-native'
import * as Styles from '@/styles'
import type {Props} from './list.shared'
import {LegendList as LegendListWeb} from '@legendapp/list/react'
import {LegendList as LegendListNative} from '@legendapp/list/react-native'
import {smallHeight, largeHeight} from './list-item'
export type {LegendListRef, Props} from './list.shared'

function useListProps<T>(p: Props<T>) {
  const {
    items,
    renderItem,
    itemHeight,
    onEndReached,
    keyProperty,
    estimatedItemHeight,
    extraData: extraDataProp,
    selectedIndex,
    ListHeaderComponent,
    ListFooterComponent,
    recycleItems: recycleItemsOverride,
  } = p
  const {getItemType, drawDistance, onViewableItemsChanged, viewabilityConfig} = p

  const legendRenderItem = ({item, index}: {item: T; index: number}) => {
    return renderItem(index, item)
  }

  const keyExtractor = p.keyExtractor
    ? p.keyExtractor
    : keyProperty
      ? (item: T, _index: number) => String((item as Record<string, unknown>)[keyProperty])
      : (_item: T, index: number) => String(index)

  const getFixedItemSize =
    itemHeight.type === 'fixed'
      ? () => itemHeight.height
      : itemHeight.type === 'fixedListItemAuto'
        ? () => (itemHeight.sizeType === 'Large' ? largeHeight : smallHeight)
        : itemHeight.type === 'variable'
          ? (item: T, index: number) => itemHeight.getItemLayout(index, item).length
          : itemHeight.type === 'perItem'
            ? (item: T) => itemHeight.getSize(item)
            : undefined

  const estimatedItemSize =
    estimatedItemHeight ??
    (itemHeight.type === 'fixed'
      ? itemHeight.height
      : itemHeight.type === 'fixedListItemAuto'
        ? itemHeight.sizeType === 'Large'
          ? largeHeight
          : smallHeight
        : 48)

  const recycleItems =
    recycleItemsOverride ??
    (itemHeight.type === 'fixed' || itemHeight.type === 'fixedListItemAuto' || itemHeight.type === 'perItem')

  return {
    empty: items.length === 0 && !ListHeaderComponent && !ListFooterComponent,
    listProps: {
      ListFooterComponent,
      ListHeaderComponent,
      data: items as T[],
      drawDistance,
      estimatedItemSize,
      extraData: extraDataProp ?? selectedIndex,
      getFixedItemSize,
      getItemType,
      keyExtractor,
      onEndReached: onEndReached ? () => onEndReached() : undefined,
      onViewableItemsChanged: onViewableItemsChanged as any,
      recycleItems,
      renderItem: legendRenderItem,
      viewabilityConfig,
    },
  }
}

const DesktopList = function List<T>({ref, ...p}: Props<T>) {
  const {empty, listProps} = useListProps(p as Props<T>)
  const {style} = p
  if (empty) return null

  return (
    <LegendListWeb
      ref={ref as never}
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

const NativeList = function List<T>({ref, ...p}: Props<T>) {
  const {empty, listProps} = useListProps(p as Props<T>)
  if (empty) return null

  return (
    <View style={styles.outerView}>
      <LegendListNative
        ref={ref as never}
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
        // without shrink, content taller than the available space keeps its
        // content height and paints past the parent (e.g. over modal footers)
        flexShrink: 1,
        position: 'relative',
      },
    }) as const
)

export default isMobile ? NativeList : DesktopList
