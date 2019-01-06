// @flow
import * as React from 'react'
import * as Styles from '../../../styles'
import Rm from 'react-measure'
import type {Props} from '.'

class Measure extends React.Component<Props, {width: number}> {
  _onResize = contentRect => {
    this.props.onMeasured(contentRect.bounds.width)
  }

  render() {
    return (
      <Rm bounds={true} onResize={this._onResize}>
        {({measureRef}) => <div ref={measureRef} style={styles.container} />}
      </Rm>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {width: '100%'},
})

export default Measure
