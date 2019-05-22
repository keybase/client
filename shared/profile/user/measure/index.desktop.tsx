import * as React from 'react'
import * as Styles from '../../../styles'
import Rm from 'react-measure'
import {Props} from '.'

class Measure extends React.Component<
  Props,
  {
    width: number
  }
> {
  _width = 0
  _onResize = contentRect => {
    if (this._width !== contentRect.bounds.width) {
      this._width = contentRect.bounds.width
      this.props.onMeasured(this._width)
    }
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
