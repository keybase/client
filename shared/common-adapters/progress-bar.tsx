import Box from './box'
import {useSpring, animated} from 'react-spring'
import * as Styles from '../styles'

type Props = {
  ratio: number
  style?: any
  fillStyle?: any
}

const AnimatedBox = animated(Box)

const ProgressBar = ({ratio, style, fillStyle}: Props) => {
  const animatedStyles = useSpring({
    from: {...styles.inner, ...fillStyle},
    to: {width: `${Math.max(0, Math.min(1, ratio)) * 100}%`},
  })
  return (
    <Box style={Styles.collapseStyles([styles.outer, style])}>
      <AnimatedBox style={animatedStyles} />
    </Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  inner: {
    backgroundColor: Styles.globalColors.blue,
    borderRadius: 3,
    height: 4,
  },
  outer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.greyLight,
      borderRadius: 3,
      height: 4,
      width: 64,
    },
    isElectron: {
      boxShadow: `inset 0 1px 0 0 ${Styles.globalColors.black_05}`,
    },
  }),
}))

export default ProgressBar
