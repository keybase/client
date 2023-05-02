import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import type {Props} from './custom-emoji'

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
