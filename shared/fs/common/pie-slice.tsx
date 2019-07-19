import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles/index'

type Props = {
  degrees: number
  animated?: boolean
  negative?: boolean
  style?: Styles.StylesCrossPlatform
}

const PieSliceDefault = (props: Props) => {
  const styleFilled = props.negative ? styles.filledNegative : styles.filledPositive
  const styleUnfilled = props.negative ? styles.unfilledNegative : styles.unfilledPositive
  const styleRotate = Styles.isMobile
    ? {transform: [{rotate: props.degrees + 'deg'}]}
    : {transform: 'rotate(' + props.degrees + 'deg)'}
  return (
    <Kb.Box style={Styles.collapseStyles([styles.container, ...(props.style ? [props.style] : [])])}>
      <Kb.Box style={Styles.collapseStyles([styles.wholeUnfilled, styleUnfilled])} />
      <Kb.Box style={Styles.collapseStyles([styles.rotateContainer, styleRotate])}>
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

const PieSlice = (props: Props) => {
  return props.animated ? (
    <Kb.Animated to={{degrees: props.degrees}}>
      {({degrees}) => <PieSliceDefault degrees={degrees} style={props.style} negative={props.negative} />}
    </Kb.Animated>
  ) : (
    <PieSliceDefault degrees={props.degrees} style={props.style} negative={props.negative} />
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
const styles = Styles.styleSheetCreate({
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
  },
  leftUnfilled: {
    ...stylePieHalf,
    borderBottomLeftRadius: pieHalfSize,
    borderTopLeftRadius: pieHalfSize,
    left: 0,
  },
  rightFilled: {
    ...stylePieHalf,
    borderBottomRightRadius: pieHalfSize,
    borderTopRightRadius: pieHalfSize,
    left: pieHalfSize,
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
  },
})

export default PieSlice
