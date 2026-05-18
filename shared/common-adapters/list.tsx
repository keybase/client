import type {CSSProperties} from 'react'
import {View} from 'react-native'
import * as Styles from '@/styles'
import type {Props} from './list.shared'
import type {LegendListComponent as LegendListWebType} from '@legendapp/list/react'
import type {LegendListComponent as LegendListNativeType} from '@legendapp/list/react-native'
import {useListProps} from './list-common'
export type {LegendListRef, Props} from './list.shared'

const DesktopList = function List<T>({ref, ...p}: Props<T>) {
  const {LegendList} = require('@legendapp/list/react') as {LegendList: LegendListWebType}
  const {empty, ...listProps} = useListProps(p as Props<T>)
  const {style} = p
  if (empty) return null

  return (
    <LegendList
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
  const {LegendList} = require('@legendapp/list/react-native') as {LegendList: LegendListNativeType}
  const {empty, ...listProps} = useListProps(p as Props<T>)
  if (empty) return null

  return (
    <View style={styles.outerView}>
      <LegendList
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
        position: 'relative',
      },
    }) as const
)

export default isMobile ? NativeList : DesktopList
