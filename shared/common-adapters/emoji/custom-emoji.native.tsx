import Image from '@/common-adapters/image'
import * as Styles from '@/styles'
import type {Props} from '@/common-adapters/emoji/custom-emoji.shared'


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
