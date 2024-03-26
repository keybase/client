import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {Props} from '.'
import {View, type LayoutChangeEvent} from 'react-native'

class Measure extends React.Component<Props> {
  _onLayout = (e: LayoutChangeEvent) => {
    this.props.onMeasured(e.nativeEvent.layout.width)
  }
  render() {
    return <View style={styles.container} onLayout={this._onLayout} />
  }
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {width: '100%'},
}))

export default Measure
