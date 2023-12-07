import * as React from 'react'
import {Image2} from '@/common-adapters'
import QRCodeGen from 'qrcode-generator'

const Kb = {
  Image2,
}

type Props = {
  code: string
  cellSize?: 8 | 10 // we ONLY allow even numbers else you'll get fractional pixels and it looks blurry
}

const QrImage = React.memo(function QrImage(p: Props) {
  const {code, cellSize = 8} = p
  const qr = QRCodeGen(4, 'L')
  qr.addData(code)
  qr.make()
  const size = qr.getModuleCount() * (cellSize / 2) // retina
  // Keybase blue
  const url = qr.createDataURL(cellSize, 0, [0x4c, 0x8e, 0xff])
  return <Kb.Image2 src={url} style={{height: size, width: size}} />
})

export default QrImage
