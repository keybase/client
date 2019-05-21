import * as React from 'react'
import * as Kb from '../../../common-adapters/mobile.native'
import * as Styles from '../../../styles'
import {Props} from '.'

class Measure extends React.Component<Props> {
  _onLayout = e => {
    this.props.onMeasured(e.nativeEvent.layout.width)
  }
  render() {
    return <Kb.NativeView style={styles.container} onLayout={this._onLayout} />
  }
}

const styles = Styles.styleSheetCreate({
  container: {width: '100%'},
})

export default Measure
