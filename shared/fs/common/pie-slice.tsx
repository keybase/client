import * as Kb from '../../common-adapters'
import * as Styles from '../../styles/index'
import {useSpring, animated} from 'react-spring'

type Props = {
  degrees: number
  animated?: boolean
  negative?: boolean
  style?: Styles.StylesCrossPlatform
}

const Slice = (props: Props) => {
  const styleFilled = props.negative ? styles.filledNegative : styles.filledPositive
  const styleUnfilled = props.negative ? styles.unfilledNegative : styles.unfilledPositive
  const styleRotate = Styles.isMobile
    ? {transform: [{rotate: props.degrees + 'deg'}]}
    : {transform: 'rotate(' + props.degrees + 'deg)'}
  return (
    <Kb.Box style={Styles.collapseStyles([styles.container, ...(props.style ? [props.style] : [])])}>
      <Kb.Box style={Styles.collapseStyles([styles.wholeUnfilled, styleUnfilled])} />
      <Kb.Box style={Styles.collapseStyles([styles.rotateContainer, styleRotate] as any)}>
        <Kb.Box style={Styles.collapseStyles([styles.leftFilled, styleFilled])} />
      </Kb.Box>
      <Kb.Box
        style={Styles.collapseStyles(
          props.degrees <= 180 ? [styles.leftUnfilled, styleUnfilled] : [styles.rightFilled, styleFilled]
        )}
      />
    </Kb.Box>
  )
}

const AnimatedSlice = animated(Slice)
const AnimatedPieSlice = (props: Props) => {
  const {degrees} = props
  const ad = useSpring({to: {degrees}})
  return <AnimatedSlice degrees={ad.degrees} style={props.style as any} negative={props.negative} />
}

const PieSlice = (props: Props) => {
  return props.animated ? (
    <AnimatedPieSlice {...props} />
  ) : (
    <Slice degrees={props.degrees} style={props.style} negative={props.negative} />
  )
}
const pieSize = Styles.isMobile ? 16 : 12
const pieHalfSize = Styles.isMobile ? 8 : 6
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
const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        height: pieSize,
        position: 'relative' as const,
        width: pieSize,
      },
      filledNegative: {
        backgroundColor: Styles.globalColors.greyLight,
      },
      filledPositive: {
        backgroundColor: Styles.globalColors.blue,
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
        backgroundColor: Styles.globalColors.blueDark,
      },
      unfilledPositive: {
        backgroundColor: Styles.globalColors.greyLight,
      },
      wholeUnfilled: {
        ...stylePieWhole,
        borderRadius: pieHalfSize,
        overflow: 'hidden',
      },
    } as const)
)

export default PieSlice
