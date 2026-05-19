import type {CSSProperties} from 'react'
import {View} from 'react-native'
import * as Styles from '@/styles'
import type {Props} from './list.shared'
import {LegendList as LegendListWeb} from '@legendapp/list/react'
import {LegendList as LegendListNative} from '@legendapp/list/react-native'
import {useListProps} from './list-common'
export type {LegendListRef, Props} from './list.shared'

const DesktopList = function List<T>({ref, ...p}: Props<T>) {
  const {empty, ...listProps} = useListProps(p as Props<T>)
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
  const {empty, ...listProps} = useListProps(p as Props<T>)
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
        position: 'relative',
      },
    }) as const
)

export default isMobile ? NativeList : DesktopList
