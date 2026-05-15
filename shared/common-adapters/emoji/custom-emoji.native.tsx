import Image from '@/common-adapters/image'
import * as Styles from '@/styles'


export type Props = {
  size: number
  src: string
  alias?: string
  style?: Styles.StylesCrossPlatform
}
const CustomEmoji = (props: Props) => {
  const {size, src, style} = props
  const dimensions = {
    height: size,
    transform: [{translateY: Styles.isAndroid ? 4 : 2}],
    width: size,
    ...style,
  }

  return <Image key={size} src={src} style={dimensions} />
}

export default CustomEmoji
