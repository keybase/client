import Box from './box'
import * as Styles from '@/styles'

type Props = {
  ratio: number
  style?: Styles.StylesCrossPlatform
  fillStyle?: Styles.StylesCrossPlatform
}

const ProgressBar = ({ratio, style, fillStyle}: Props) => {
  const animatedStyles = {
    ...styles.inner,
    ...fillStyle,
    width: `${Math.max(0, Math.min(1, ratio)) * 100}%`,
  }
  return (
    <Box style={Styles.collapseStyles([styles.outer, style])}>
      <Box style={animatedStyles} />
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
