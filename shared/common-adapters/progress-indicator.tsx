import {ActivityIndicator} from 'react-native'
import Animation from './animation'
import * as Styles from '@/styles'

type Props = {
  style?: Styles.StylesCrossPlatform
  white?: boolean
  type?: 'Small' | 'Large' | 'Huge'
}

const ProgressIndicator = (p: Props) => {
  if (isMobile) {
    const size = p.type === 'Large' ? 'large' : 'small'
    return (
      <ActivityIndicator
        color={p.white ? Styles.globalColors.whiteOrWhite : Styles.globalColors.black}
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
  alignItems: 'center',
  justifyContent: 'center',
} as const

const desktopStyles = Styles.styleSheetCreate(() => ({
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
