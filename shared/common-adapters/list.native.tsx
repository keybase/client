import {View} from 'react-native'
import * as Styles from '@/styles'
import {LegendList} from '@legendapp/list/react-native'
import type {Props} from './list'
import {useListProps} from './list-common'

function List<T>(p: Props<T>) {
  const {empty, ...listProps} = useListProps(p)
  if (empty) return null

  return (
    <View style={styles.outerView}>
      <LegendList
        {...listProps}
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
