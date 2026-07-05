import * as Kb from '@/common-adapters'

// Question screens in reset/ and recover-password/ hug the top on mobile instead of centering
export const commonStyles = Kb.Styles.styleSheetCreate(() => ({
  topGap: Kb.Styles.platformStyles({
    isMobile: {
      justifyContent: 'flex-start',
      marginTop: '20%',
    },
  }),
}))
