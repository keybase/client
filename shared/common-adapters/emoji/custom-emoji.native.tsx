import type {Props} from './custom-emoji'
import Image2 from '@/common-adapters/image2'

const CustomEmoji = (props: Props) => {
  const {size, src} = props
  // TODO
  const inText = false
  const dimensions = {
    height: size,
    width: size,
    ...props.style,
    ...(inText ? {transform: [{translateY: 6}]} : {}),
    //
  }

  return <Image2 key={size} src={src} style={dimensions} />
}

export default CustomEmoji
