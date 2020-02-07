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
      width: 460,
      alignSelf: 'center',
    },
  }),
  spinnerContainer: {...Styles.globalStyles.fillAbsolute},
}))
