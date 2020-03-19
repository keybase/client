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

type Props = {
  size: keyof typeof emojiTypes
  src: string
  alias?: string
}

const emojiTypes = {
  Big: 32,
  Medium: 24,
  Small: 18,
}

const CustomEmoji = (props: Props) => {
  const {size, src, alias} = props
  // TODO: make tooltip with alias for desktop
  return (
    // <Kb.WithTooltip
    //   tooltip={alias ?? null}
    // >
    <Kb.Image
      src={src}
      style={Styles.collapseStyles([
        {
          height: emojiTypes[size],
          width: emojiTypes[size],
        },
      ])}
    />
    // </Kb.WithTooltip>
  )
}

export default CustomEmoji
