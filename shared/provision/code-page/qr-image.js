// @flow
import * as React from 'react'
import {Image} from '../../common-adapters'
import QRCodeGen from 'qrcode-generator'

type Props = {
  code: string,
  cellSize: 4 | 6, // we ONLY allow even numbers else you'll get fractional pixels and it looks blurry
}

class QrImage extends React.PureComponent<Props> {
  static defaultProps = {cellSize: 4}
  render() {
    const qr = QRCodeGen(4, 'L')
    qr.addData(this.props.code)
    qr.make()
    const size = qr.getModuleCount() * (this.props.cellSize / 2) // retina
    const url = qr.createDataURL(this.props.cellSize, 0)
    return <Image src={url} style={{height: size, width: size}} />
  }
}

export default QrImage
