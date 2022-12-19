import {FastImage} from './native-image.native'
import type {Props} from './custom-emoji'

const CustomEmoji = (props: Props) => {
  const {size, src} = props
  const dimensions = {
    height: size,
    width: size,
    ...props.style,
  }

  return (
    <FastImage key={size} source={{uri: src}} style={dimensions} resizeMode={FastImage.resizeMode.contain} />
  )
}

export default CustomEmoji
