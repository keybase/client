// @flow
import * as React from 'react'
import Box from './box'
import Text from './text'
import HeaderHoc from './header-hoc'
import * as Styles from '../styles'
import type {Props} from './standard-screen'

const StandardScreen = ({theme = 'light', ...props}: Props) => {
  const topStack = [
    !!props.notification && (
      <Box key="banner" style={Styles.collapseStyles([styles.banner, props.notification.type && styles.bannerError, props.styleBanner])}>
        {typeof props.notification.message === 'string' ? (
          <Text style={styles.bannerText} type="BodySmallSemibold">
            {props.notification.message}
          </Text>
        ) : (
          props.notification.message
        )}
      </Box>
    ),
  ]
  const topStackCount = topStack.reduce((acc, x) => acc + !!x, 0)
  return (
    <Box style={Styles.collapseStyles([styles.container, theme === 'dark' && styles.containerDark])}>
      <Box style={styles.topStack}>{topStack}</Box>
      <Box style={Styles.collapseStyles([styles.innerContainer, {paddingBottom: topStackCount * Styles.globalMargins.large}])}>
        <Box style={Styles.collapseStyles([styles.contentContainer, props.style])}>{props.children}</Box>
      </Box>
    </Box>
  )
}

const styles = Styles.styleSheetCreate({
  banner: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.green,
    justifyContent: 'center',
    minHeight: Styles.globalMargins.large,
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.xlarge,
    paddingRight: Styles.globalMargins.xlarge,
    paddingTop: Styles.globalMargins.tiny,
    textAlign: 'center',
    width: '100%',
    zIndex: 1,
  },
  bannerError: {
    backgroundColor: Styles.globalColors.red,
  },
  bannerText: {
    color: Styles.globalColors.white,
  },
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'stretch',
      backgroundColor: Styles.globalColors.white,
      flex: 1,
      position: 'relative',
    },
    isElectron: {
      ...Styles.desktopStyles.scrollable,
    },
  }),
  containerDark: {
    backgroundColor: Styles.globalColors.darkBlue3,
  },
  contentContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    margin: Styles.globalMargins.large,
    textAlign: 'center',
  },
  innerContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  topStack: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    position: 'relative',
    width: '100%',
  },
})

export default HeaderHoc(StandardScreen)
