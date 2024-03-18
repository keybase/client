import Box from './box'
import * as Styles from '@/styles'

type Props = {
  ratio: number
  style?: Styles.StylesCrossPlatform
  fillStyle?: Styles.StylesCrossPlatform
  flatRight?: boolean
  flatLeft?: boolean
}

const ProgressBar = ({ratio, style, fillStyle, flatLeft, flatRight}: Props) => {
  const animatedStyles = {
    ...styles.inner,
    ...fillStyle,
    ...(flatLeft && styles.flatLeft),
    ...(flatRight && styles.flatRight),
    width: `${Math.max(0, Math.min(1, ratio)) * 100}%`,
  }
  return (
    <Box
      style={Styles.collapseStyles([
        styles.outer,
        style,
        flatLeft ? styles.flatLeft : {},
        flatRight ? styles.flatRight : {},
      ])}
    >
      <Box style={animatedStyles} />
    </Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  flatLeft: {borderBottomLeftRadius: 0, borderTopLeftRadius: 0},
  flatRight: {borderBottomRightRadius: 0, borderTopRightRadius: 0},
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
