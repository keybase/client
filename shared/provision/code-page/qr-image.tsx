import {Image} from '@/common-adapters'
import generateQRDataURL from '@/util/qr-code'

const Kb = {
  Image,
}

type Props = {
  code: string
  cellSize?: 8 | 10 // we ONLY allow even numbers else you'll get fractional pixels and it looks blurry
}

function QrImage(p: Props) {
  const {code, cellSize = 8} = p
  const {url, moduleCount} = generateQRDataURL(code, cellSize)
  const size = moduleCount * (cellSize / 2) // retina
  return <Kb.Image src={url} style={{height: size, width: size}} />
}

export default QrImage
