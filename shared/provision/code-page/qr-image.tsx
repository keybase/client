import * as React from 'react'
import {Image2} from '../../common-adapters'
// @ts-ignore
import QRCodeGen from 'qrcode-generator'

const Kb = {
  Image2,
}

type Props = {
  code: string
  cellSize: 8 | 10 // we ONLY allow even numbers else you'll get fractional pixels and it looks blurry
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

    return <Kb.Image2 src={url} style={{height: size, width: size}} />
  }
}

export default QrImage
