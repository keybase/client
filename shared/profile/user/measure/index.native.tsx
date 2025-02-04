import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {Props} from '.'
import {View, type LayoutChangeEvent} from 'react-native'

const Measure = (props: Props) => {
  const {onMeasured} = props
  const onLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      onMeasured(e.nativeEvent.layout.width)
    },
    [onMeasured]
  )

  return <View style={styles.container} onLayout={onLayout} />
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {width: '100%'},
}))

export default Measure
