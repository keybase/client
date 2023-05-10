import * as React from 'react'
import * as Styles from '../../../styles'
import type {Props} from '.'
import {View} from 'react-native'

class Measure extends React.Component<Props> {
  _onLayout = e => {
    this.props.onMeasured(e.nativeEvent.layout.width)
  }
  render() {
    return <View style={styles.container} onLayout={this._onLayout} />
  }
}

const styles = Styles.styleSheetCreate(() => ({
  container: {width: '100%'},
}))

export default Measure
