import type {Props} from './custom-emoji'
import * as Kb from '../common-adapters'

const CustomEmoji = (props: Props) => {
  const {size, src} = props
  const dimensions = {
    height: size,
    width: size,
    ...props.style,
  }

  // contain?
  return <Kb.Image2 key={size} src={src} style={dimensions} />
}

export default CustomEmoji
