import * as React from 'react'
import * as Styles from '../styles'
import Image from './image'
import Text from './text'
import WithTooltip from './with-tooltip'
const Kb = {
  Image,
  Text,
  WithTooltip,
}

import {Props} from './custom-emoji'

const emojiTypes = {
  Big: 32,
  Medium: 24,
  Small: 20,
}

const CustomEmoji = (props: Props) => {
  const {size, src} = props
  return (
    <Kb.Image
      src={src}
      style={{
        height: emojiTypes[size],
        width: emojiTypes[size],
      }}
    />
  )
}

export default CustomEmoji
