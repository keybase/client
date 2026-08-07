import {ActivityIndicator} from 'react-native'
import Animation from './animation'
import * as Styles from '@/styles'

type Props = {
  style?: Styles.StylesCrossPlatform
  white?: boolean
  type?: 'Small' | 'Large' | 'Huge'
}

const ProgressIndicator = (p: Props) => {
  const desktopStyles = useDesktopStyles()
  const theme = Styles.useTheme()
  if (isMobile) {
    const size = p.type === 'Large' ? 'large' : 'small'
    return (
      <ActivityIndicator
        color={p.white ? theme.whiteOrWhite : theme.black}
        size={size}
        style={Styles.collapseStyles([nativeStyle, p.style])}
      />
    )
  }
  return (
    <Animation
      animationType={p.white ? 'spinnerWhite' : 'spinner'}
      style={Styles.collapseStyles([
        p.type === 'Small' && desktopStyles.small,
        p.type === 'Large' && desktopStyles.large,
        p.type === 'Huge' && desktopStyles.huge,
        p.style,
      ])}
    />
  )
}

const nativeStyle = {
  ...Styles.centered(),
} as const

const useDesktopStyles = Styles.createStyleHook(() => ({
  huge: {
    ...Styles.size(Styles.globalMargins.xlarge),
  },
  large: {
    ...Styles.size(Styles.globalMargins.mediumLarge),
  },
  small: {
    ...Styles.size(Styles.globalMargins.medium),
  },
}))

export default ProgressIndicator
