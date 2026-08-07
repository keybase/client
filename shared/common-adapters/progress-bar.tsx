import {Box2} from './box'
import * as Styles from '@/styles'

type Props = {
  ratio: number
  style?: Styles.StylesCrossPlatform
  fillStyle?: Styles.StylesCrossPlatform
  flatRight?: boolean
  flatLeft?: boolean
}

const ProgressBar = ({ratio, style, fillStyle, flatLeft, flatRight}: Props) => {
  const styles = useStyles()
  const animatedStyles = {
    ...styles.inner,
    ...fillStyle,
    ...(flatLeft && styles.flatLeft),
    ...(flatRight && styles.flatRight),
    width: `${Math.max(0, Math.min(1, ratio)) * 100}%`,
  } as const
  return (
    <Box2
      direction="vertical"
      style={Styles.collapseStyles([
        styles.outer,
        style,
        flatLeft ? styles.flatLeft : {},
        flatRight ? styles.flatRight : {},
      ])}
    >
      <Box2 direction="vertical" style={animatedStyles} />
    </Box2>
  )
}

const useStyles = Styles.createStyleHook(theme => ({
  flatLeft: {borderBottomLeftRadius: 0, borderTopLeftRadius: 0},
  flatRight: {borderBottomRightRadius: 0, borderTopRightRadius: 0},
  inner: {
    alignSelf: 'flex-start',
    backgroundColor: theme.blue,
    ...Styles.globalStyles.rounded,
    height: 4,
  },
  outer: Styles.platformStyles({
    common: {
      backgroundColor: theme.greyLight,
      ...Styles.globalStyles.rounded,
      height: 4,
      width: 64,
    },
    isElectron: {
      boxShadow: `inset 0 1px 0 0 ${theme.black_05}`,
    },
  }),
}))

export default ProgressBar
