import * as Kb from '@/common-adapters'
import {Splash} from '../login/loading'
import type {Theme} from '@react-navigation/native'
import {colors, darkColors} from '@/styles/colors'

export function SimpleLoading() {
  return (
    <Kb.Box2
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      style={{backgroundColor: Kb.Styles.globalColors.white}}
    >
      <Splash allowFeedback={false} failed="" status="" />
    </Kb.Box2>
  )
}

// the nav assumes plain colors for animation in some cases so we can't use the themed colors there
export const darkTheme: Theme = {
  colors: {
    background: darkColors.white,
    border: darkColors.black_10,
    card: undefined as unknown as string,
    notification: darkColors.black,
    primary: darkColors.black,
    text: darkColors.black,
  },
  dark: true,
  fonts: {
    bold: Kb.Styles.globalStyles.fontBold,
    heavy: Kb.Styles.globalStyles.fontExtrabold,
    medium: Kb.Styles.globalStyles.fontSemibold,
    regular: Kb.Styles.globalStyles.fontRegular,
  },
}
export const lightTheme: Theme = {
  colors: {
    background: colors.white,
    border: colors.black_10,
    card: undefined as unknown as string,
    notification: colors.black,
    primary: colors.black,
    text: colors.black,
  },
  dark: false,
  fonts: {
    bold: Kb.Styles.globalStyles.fontBold,
    heavy: Kb.Styles.globalStyles.fontExtrabold,
    medium: Kb.Styles.globalStyles.fontSemibold,
    regular: Kb.Styles.globalStyles.fontRegular,
  },
}
