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
      width: '100%',
    },
    isTablet: {
      alignSelf: 'center',
      width: Styles.globalStyles.mediumWidth,
    },
  }),
  spinnerContainer: {...Styles.globalStyles.fillAbsolute},
}))
