import {View} from 'react-native'
import * as Styles from '@/styles'
import {LegendList} from '@legendapp/list/react-native'
import type {Props} from './list'
import {useListProps} from './list-common'

function List<T>({ref, ...p}: Props<T>) {
  const {empty, ...listProps} = useListProps(p as Props<T>)
  if (empty) return null

  return (
    <View style={styles.outerView}>
      <LegendList
        ref={ref as any}
        {...listProps}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps={p.keyboardShouldPersistTaps ?? 'handled'}
        overScrollMode="never"
        {...(p.testID === undefined ? {} : {testID: p.testID})}
        {...(p.bounces === undefined ? {} : {bounces: p.bounces})}
        {...(p.style === undefined ? {} : {contentContainerStyle: p.style})}
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
