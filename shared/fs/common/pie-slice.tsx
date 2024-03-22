import * as Kb from '@/common-adapters'

type Props = {
  degrees: number
  animated?: boolean
  negative?: boolean
  style?: Kb.Styles.StylesCrossPlatform
}

const Slice = (props: Props) => {
  const styleFilled = props.negative ? styles.filledNegative : styles.filledPositive
  const styleUnfilled = props.negative ? styles.unfilledNegative : styles.unfilledPositive
  return (
    <Kb.Box style={Kb.Styles.collapseStyles([styles.container, ...(props.style ? [props.style] : [])])}>
      <Kb.Box style={Kb.Styles.collapseStyles([styles.wholeUnfilled, styleUnfilled])} />
      <Kb.Box
        style={Kb.Styles.collapseStyles([
          styles.rotateContainer,
          Kb.Styles.platformStyles({
            isElectron: {transform: 'rotate(' + props.degrees + 'deg)'},
            isMobile: {transform: [{rotate: props.degrees + 'deg'}]},
          }),
        ])}
      >
        <Kb.Box style={Kb.Styles.collapseStyles([styles.leftFilled, styleFilled])} />
      </Kb.Box>
      <Kb.Box
        style={Kb.Styles.collapseStyles(
          props.degrees <= 180 ? [styles.leftUnfilled, styleUnfilled] : [styles.rightFilled, styleFilled]
        )}
      />
    </Kb.Box>
  )
}

const AnimatedPieSlice = (props: Props) => {
  const {degrees} = props
  return <Slice degrees={degrees} style={props.style} negative={props.negative} />
}

const PieSlice = (props: Props) => {
  return props.animated ? (
    <AnimatedPieSlice {...props} />
  ) : (
    <Slice degrees={props.degrees} style={props.style} negative={props.negative} />
  )
}
const pieSize = Kb.Styles.isMobile ? 16 : 12
const pieHalfSize = Kb.Styles.isMobile ? 8 : 6
const stylePieHalf = {
  height: pieSize,
  position: 'absolute' as const,
  width: pieHalfSize,
}
const stylePieWhole = {
  height: pieSize,
  position: 'absolute' as const,
  width: pieSize,
}
const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        height: pieSize,
        position: 'relative' as const,
        width: pieSize,
      },
      filledNegative: {
        backgroundColor: Kb.Styles.globalColors.greyLight,
      },
      filledPositive: {
        backgroundColor: Kb.Styles.globalColors.blue,
      },
      leftFilled: {
        ...stylePieHalf,
        borderBottomLeftRadius: pieHalfSize,
        borderTopLeftRadius: pieHalfSize,
        left: 0,
        overflow: 'hidden', // need to set this so it's fully round on mobile
      },
      leftUnfilled: {
        ...stylePieHalf,
        borderBottomLeftRadius: pieHalfSize,
        borderTopLeftRadius: pieHalfSize,
        left: 0,
        overflow: 'hidden',
      },
      rightFilled: {
        ...stylePieHalf,
        borderBottomRightRadius: pieHalfSize,
        borderTopRightRadius: pieHalfSize,
        left: pieHalfSize,
        overflow: 'hidden',
      },
      rotateContainer: {
        ...stylePieWhole,
        left: 0,
      },
      unfilledNegative: {
        backgroundColor: Kb.Styles.globalColors.blueDark,
      },
      unfilledPositive: {
        backgroundColor: Kb.Styles.globalColors.greyLight,
      },
      wholeUnfilled: {
        ...stylePieWhole,
        borderRadius: pieHalfSize,
        overflow: 'hidden',
      },
    }) as const
)

export default PieSlice
