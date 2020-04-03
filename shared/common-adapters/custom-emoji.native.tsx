import * as React from 'react'
import Image from './image'
import {Box2} from './box'
import Text from './text'
import WithTooltip from './with-tooltip'
import {Props} from './custom-emoji'

const Kb = {
  Box2,
  Image,
  Text,
  WithTooltip,
}

const emojiTypes = {
  Big: 32,
  Medium: 24,
  MediumLarge: 24,
  Small: 20,
}

const CustomEmoji = (props: Props) => {
  const {size, src} = props
  return (
    <Kb.Box2 direction="horizontal">
      <Kb.Image
        src={src}
        style={{
          height: emojiTypes[size],
          width: emojiTypes[size],
        }}
      />
    </Kb.Box2>
  )
}

export default CustomEmoji
