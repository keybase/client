// @flow
import * as React from 'react'
import {Image} from '../../common-adapters'
import QRCodeGen from 'qrcode-generator'
import {styleSheetCreate} from '../../styles'

type Props = {
  code: string,
  cellSize: number,
}

class QrImage extends React.PureComponent<Props> {
  static defaultProps = {cellSize: 4} // this creates a 132x132 (so we can use retina) image
  render() {
    const qr = QRCodeGen(4, 'L')
    qr.addData(this.props.code)
    qr.make()

    const url = qr.createDataURL(this.props.cellSize, 0)
    return <Image src={url} style={styles.image} />
  }
}

const styles = styleSheetCreate({
  image: {
    // actual qr size so it doesn't stretch
    height: 66,
    width: 66,
  },
})

export default QrImage
