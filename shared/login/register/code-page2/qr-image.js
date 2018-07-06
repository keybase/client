// @flow
import * as React from 'react'
import {Box} from '../../../common-adapters'
import {globalColors} from '../../../styles'
import QRCodeGen from 'qrcode-generator'

type Props = {
  code: string,
}

const cellSize = 2

class Qr extends React.PureComponent<Props> {
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
            style={{
              backgroundColor: globalColors.blue3,
              height: cellSize,
              left: x * cellSize,
              position: 'absolute',
              top: y * cellSize,
              width: cellSize,
            }}
          />
        )
      }
    }

    return <React.Fragment>{children}</React.Fragment>
  }
}

export default Qr
