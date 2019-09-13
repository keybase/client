import * as React from 'react'
import {Image} from '../../common-adapters'
import QRCodeGen from 'qrcode-generator'

type Props = {
  code: string
  cellSize: 8 | 10
}

class QrImage extends React.PureComponent<Props> {
  static defaultProps = {cellSize: 8}
  render() {
    const qr = QRCodeGen(4, 'L')
    qr.addData(this.props.code)
    qr.make()
    const size = qr.getModuleCount() * (this.props.cellSize / 2) // retina
    // Keybase blue
    const url = qr.createDataURL(this.props.cellSize, 0, [0x4c, 0x8e, 0xff])

    return <Image src={url} style={{height: size, width: size}} />
  }
}

export default QrImage
