import type {Props} from './custom-emoji'
import Image2 from '@/common-adapters/image2'

const CustomEmoji = (props: Props) => {
  const {size, src, style} = props
  const dimensions = {
    height: size,
    transform: [{translateY: 2}],
    width: size,
    ...style,
  }

  return <Image2 key={size} src={src} style={dimensions} />
}

export default CustomEmoji
