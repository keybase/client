import * as React from 'react'
import * as Styles from '../styles'
import Image from './image'
import Text from './text'
import {Box2} from './box'
import WithTooltip from './with-tooltip'
import {Props} from './custom-emoji'

const Kb = {
  Box2,
  Image,
  Text,
  WithTooltip,
}

const CustomEmoji = (props: Props) => {
  const {size, src, alias} = props
  return (
    <Kb.Box2
      direction="horizontal"
      style={Styles.collapseStyles([
        styles.emoji,
        {
          height: size,
          width: size,
        },
      ])}
    >
      <Kb.WithTooltip tooltip={alias ?? null}>
        <Kb.Image
          src={src}
          style={Styles.collapseStyles([
            {
              height: size,
              width: size,
            },
          ])}
        />
      </Kb.WithTooltip>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      emoji: Styles.platformStyles({
        isElectron: {
          display: 'inline-block',
          verticalAlign: 'middle',
        },
      }),
    } as const)
)

export default CustomEmoji
