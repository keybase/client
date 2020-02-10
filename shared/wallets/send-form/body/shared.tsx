import * as Styles from '../../../styles'

export const sharedStyles = Styles.styleSheetCreate(() => ({
  container: {
    flexGrow: 1,
    flexShrink: 1,
  },
  scrollView: Styles.platformStyles({
    common: {
      flexGrow: 1,
      flexShrink: 1,
      width: Styles.globalStyles.mediumWidth,
    },
    isTablet: {
      alignSelf: 'center',
    },
  }),
  spinnerContainer: {...Styles.globalStyles.fillAbsolute},
}))
