import * as Styles from '@/styles'
import {Box2} from '@/common-adapters/box'
import WithTooltip from '@/common-adapters/with-tooltip'
import Image from '@/common-adapters/image'

type Props = {
  size: number
  src: string
  alias?: string
  style?: Styles.StylesCrossPlatform
}

const Kb = {
  Box2,
  Image,
  Styles,
  WithTooltip,
}

const CustomEmoji = (props: Props) => {
  const {size, src, alias, style} = props

  if (isMobile) {
    const dimensions = {
      ...Kb.Styles.size(size),
      transform: [{translateY: isAndroid ? 4 : 2}],
      ...style,
    }
    return <Image key={size} src={src} style={dimensions} />
  }

  return (
    <Kb.Box2
      direction="horizontal"
      centerChildren={true}
      style={Kb.Styles.collapseStyles([
        styles.emoji,
        {
          ...Kb.Styles.size(size),
          ...style,
        },
      ])}
    >
      <Kb.WithTooltip tooltip={alias ?? null} containerStyle={styles.tooltipContainer}>
        <Kb.Image
          src={src}
          style={{maxHeight: size, width: size}}
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
