import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles/index'

type Props = {
  degrees: number
  animated?: boolean
  style?: Styles.StylesCrossPlatform
}

const PieSliceDefault = (props: Props) => {
  const styleRotate = Styles.isMobile
    ? {transform: [{rotate: props.degrees + 'deg'}]}
    : {transform: 'rotate(' + props.degrees + 'deg)'}
  return (
    <Kb.Box style={Styles.collapseStyles([styles.container, ...(props.style ? [props.style] : [])])}>
      <Kb.Box style={styles.wholeGrey} />
      <Kb.Box style={Styles.collapseStyles([styles.rotateContainer, styleRotate])}>
        <Kb.Box style={styles.leftBlue} />
      </Kb.Box>
      {props.degrees <= 180 ? <Kb.Box style={styles.leftGrey} /> : <Kb.Box style={styles.rightBlue} />}
    </Kb.Box>
  )
}

const PieSlice = (props: Props) => {
  return props.animated ? (
    <Kb.Animated to={{degrees: props.degrees}}>
      {({degrees}: Props) => <PieSliceDefault degrees={degrees} style={props.style} />}
    </Kb.Animated>
  ) : (
    <PieSliceDefault degrees={props.degrees} style={props.style} />
  )
}
const pieSize = Styles.isMobile ? 16 : 12
const pieHalfSize = Styles.isMobile ? 8 : 6
const stylePieHalf = {
  height: pieSize,
  position: 'absolute' as 'absolute',
  width: pieHalfSize,
}
const stylePieWhole = {
  height: pieSize,
  position: 'absolute' as 'absolute',
  width: pieSize,
}
const styles = Styles.styleSheetCreate({
  container: {
    height: pieSize,
    position: 'relative' as 'relative',
    width: pieSize,
  },
  leftBlue: {
    ...stylePieHalf,
    backgroundColor: Styles.globalColors.blue,
    borderBottomLeftRadius: pieHalfSize,
    borderTopLeftRadius: pieHalfSize,
    left: 0,
  },
  leftGrey: {
    ...stylePieHalf,
    backgroundColor: Styles.globalColors.greyLight,
    // -1 is a workaround for a rendering issue where the blue part of the
    // pie is not entirely hidden by the white part
    borderBottomLeftRadius: pieHalfSize - 1,
    borderTopLeftRadius: pieHalfSize - 1,
    left: 0,
  },
  rightBlue: {
    ...stylePieHalf,
    backgroundColor: Styles.globalColors.blue,
    borderBottomRightRadius: pieHalfSize,
    borderTopRightRadius: pieHalfSize,
    left: pieHalfSize,
  },
  rotateContainer: {
    ...stylePieWhole,
    left: 0,
  },
  wholeGrey: {
    ...stylePieWhole,
    backgroundColor: Styles.globalColors.greyLight,
    // -1 is a workaround for a rendering issue where the blue part of the
    // pie is not entirely hidden by the white part
    borderRadius: pieHalfSize - 1,
  },
})

export default PieSlice
