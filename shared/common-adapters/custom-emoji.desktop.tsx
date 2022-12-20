import * as Styles from '../styles'
import Image from './image'
import Text from './text'
import {Box2} from './box'
import WithTooltip from './with-tooltip'
import type {Props} from './custom-emoji'

const Kb = {
  Box2,
  Image,
  Text,
  WithTooltip,
}

const CustomEmoji = (props: Props) => {
  const {size, src, alias, style} = props
  return (
    <Kb.Box2
      direction="horizontal"
      alignItems="center"
      style={Styles.collapseStyles([
        styles.emoji,
        {
          height: size,
          width: size,
          ...style,
        },
      ])}
    >
      <Kb.WithTooltip tooltip={alias ?? null} containerStyle={styles.tooltipContainer}>
        <Kb.Image
          src={src}
          style={Styles.collapseStyles([
            {
              maxHeight: size,
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
          display: 'inline-flex',
          justifyContent: 'center',
          verticalAlign: 'middle',
        },
      }),
      tooltipContainer: Styles.platformStyles({
        isElectron: {
          justifyContent: 'center',
        },
      }),
    } as const)
)

export default CustomEmoji
