// @flow
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles/index'

type Props = {|
  degrees: number,
  animated?: boolean,
|}

const PieSliceDefault = (props: Props) => {
  const styleLeft1 = {zIndex: props.degrees > 180 ? 1 : 3}
  const styleRight2 = {zIndex: props.degrees > 180 ? 2 : 0}
  const styleRotate = Styles.isMobile
    ? {transform: [{rotate: props.degrees + 'deg'}]}
    : {transform: 'rotate(' + props.degrees + 'deg)'}
  return (
    <Kb.Box style={styles.container}>
      <Kb.Box style={Styles.collapseStyles([styles.left1, styleLeft1])} />
      <Kb.Box style={Styles.collapseStyles([styles.rotateContainer, styleRotate])}>
        <Kb.Box style={styles.left2} />
      </Kb.Box>
      <Kb.Box style={styles.right1} />
      <Kb.Box style={Styles.collapseStyles([styles.right2, styleRight2])} />
    </Kb.Box>
  )
}

const PieSlice = (props: Props) => {
  return props.animated ? (
    <Kb.Animated to={{degrees: props.degrees}}>
      {({degrees}) => <PieSliceDefault degrees={degrees} />}
    </Kb.Animated>
  ) : (
    <PieSliceDefault degrees={props.degrees} />
  )
}

const stylePieHalf = {
  height: 12,
  position: 'absolute',
  width: 6,
}
const styles = Styles.styleSheetCreate({
  container: {
    height: 12,
    position: 'relative',
    width: 12,
  },
  left1: {
    ...stylePieHalf,
    backgroundColor: Styles.globalColors.white,
    left: 0,
  },
  left2: {
    ...stylePieHalf,
    backgroundColor: Styles.globalColors.blue,
    borderBottomLeftRadius: 6,
    borderTopLeftRadius: 6,
    left: 0,
  },
  right1: {
    ...stylePieHalf,
    backgroundColor: Styles.globalColors.white,
    left: 6,
    zIndex: 1,
  },
  right2: {
    ...stylePieHalf,
    backgroundColor: Styles.globalColors.blue,
    borderBottomRightRadius: 6,
    borderTopRightRadius: 6,
    left: 6,
  },
  rotateContainer: {
    height: 12,
    left: 0,
    position: 'absolute',
    width: 12,
    zIndex: 2,
  },
})

export default PieSlice
