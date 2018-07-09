// @flow
import * as React from 'react'
import {Box} from '../../../common-adapters'
import {globalColors} from '../../../styles'
import QRCodeGen from 'qrcode-generator'

type Props = {
  code: string,
  cellSize: number,
}

// Just rendering a bunch of divs. this is ok (maybe slow) . will have to see about native. if not go back to doing the image thing
class QrImage extends React.PureComponent<Props> {
  static defaultProps = {cellSize: 2}
  render() {
    const qr = QRCodeGen(4, 'L')
    qr.addData(this.props.code)
    qr.make()
    const size = qr.getModuleCount()
    const children = []

    for (let x = 0; x < size; ++x) {
      for (let y = 0; y < size; ++y) {
        children.push(
          <Box
            key={`${x}:${y}`}
            style={{
              backgroundColor: qr.isDark(x, y) ? globalColors.blue : globalColors.transparent,
              height: this.props.cellSize,
              left: x * this.props.cellSize,
              position: 'absolute',
              top: y * this.props.cellSize,
              width: this.props.cellSize,
            }}
          />
        )
      }
    }

    const dim = size * this.props.cellSize
    return <Box style={{height: dim, position: 'relative', width: dim}}>{children}</Box>
  }
}

export default QrImage
