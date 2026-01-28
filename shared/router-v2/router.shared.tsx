import * as Kb from '@/common-adapters'
import UploadIcon from '@/fs/common/upload-icon'
import * as React from 'react'
import {Splash} from '../login/loading'
import type {Theme} from '@react-navigation/native'
import {colors, darkColors, themed} from '@/styles/colors'
import {useFSState} from '@/stores/fs'
import {useDarkModeState} from '@/stores/darkmode'

export const SimpleLoading = React.memo(function SimpleLoading() {
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
})

export const FilesTabBadge = () => {
  const uploadIcon = useFSState(s => s.getUploadIconForFilesTab())
  return uploadIcon ? <UploadIcon uploadIcon={uploadIcon} style={styles.fsBadgeIconUpload} /> : null
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  fsBadgeIconUpload: {
    bottom: Kb.Styles.globalMargins.tiny,
    height: Kb.Styles.globalMargins.small,
    position: 'absolute',
    right: Kb.Styles.globalMargins.small,
    width: Kb.Styles.globalMargins.small,
  },
}))

// the nav assumes plain colors for animation in some cases so we can't use the themed colors there
export const theme: Theme = {
  colors: {
    get background() {
      return themed.white
    },
    get border() {
      return themed.black_10 as string
    },
    get card() {
      return (useDarkModeState.getState().isDarkMode() ? darkColors.fastBlank : colors.fastBlank) as string
    },
    get notification() {
      return themed.black as string
    },
    get primary() {
      return themed.black as string
    },
    get text() {
      return (useDarkModeState.getState().isDarkMode() ? darkColors.black : colors.black) as string
    },
  },
  dark: false,
  fonts: {
    bold: Kb.Styles.globalStyles.fontBold,
    heavy: Kb.Styles.globalStyles.fontExtrabold,
    medium: Kb.Styles.globalStyles.fontSemibold,
    regular: Kb.Styles.globalStyles.fontRegular,
  },
}
