import * as React from 'react'
import Image from './image'
import Text from './text'
import WithTooltip from './with-tooltip'
import {Props} from './custom-emoji'

const Kb = {
  Image,
  Text,
  WithTooltip,
}

const CustomEmoji = (props: Props) => {
  const {size, src} = props
  return (
    <Kb.Image
      src={src}
      style={{
        height: size,
        width: size,
      }}
    />
  )
}

export default CustomEmoji
