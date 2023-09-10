import * as Kb from '../common-adapters'
import type {Props} from './custom-emoji'

const CustomEmoji = (props: Props) => {
  const {size, src, alias, style} = props
  return (
    <Kb.Box2
      direction="horizontal"
      alignItems="center"
      style={Kb.Styles.collapseStyles([
        styles.emoji,
        {
          height: size,
          width: size,
          ...style,
        },
      ])}
    >
      <Kb.WithTooltip tooltip={alias ?? null} containerStyle={styles.tooltipContainer}>
        <Kb.Image2
          src={src}
          style={Kb.Styles.collapseStyles([
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      emoji: Kb.Styles.platformStyles({
        isElectron: {
          display: 'inline-flex',
          justifyContent: 'center',
          verticalAlign: 'middle',
        },
      }),
      tooltipContainer: Kb.Styles.platformStyles({
        isElectron: {
          justifyContent: 'center',
        },
      }),
    }) as const
)

export default CustomEmoji
