import * as React from 'react'
import * as Styles from '../styles'
import Box from './box'
import Text from './text'
import HeaderHoc from './header-hoc'
import {Props, NotificationType} from './standard-screen'

const Kb = {
  Box,
  Text,
}

const StandardScreen = (props: Props) => {
  const topStack = [
    !!props.notification && (
      <Kb.Box key="banner" style={{...styleBanner(props.notification.type), ...props.styleBanner}}>
        {typeof props.notification.message === 'string' ? (
          <Kb.Text style={styles.bannerText} type="BodySmallSemibold">
            {props.notification.message}
          </Kb.Text>
        ) : (
          props.notification.message
        )}
      </Kb.Box>
    ),
  ]
  const topStackCount = topStack.reduce((acc, x) => acc + (x ? 1 : 0), 0)
  return (
    <Kb.Box style={Styles.collapseStyles([Styles.desktopStyles.scrollable, styles.container])}>
      <Kb.Box style={styleTopStack}>{topStack}</Kb.Box>
      <Kb.Box style={{...styles.innerContainer, paddingBottom: topStackCount * Styles.globalMargins.large}}>
        <Kb.Box style={Styles.collapseStyles([styles.contentContainer, props.style])}>
          {props.children}
        </Kb.Box>
      </Kb.Box>
    </Kb.Box>
  )
}

const styleTopStack = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  position: 'relative',
  width: '100%',
}

const styleBanner = (notificationType: NotificationType) => ({
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: notificationType === 'error' ? Styles.globalColors.red : Styles.globalColors.green,
  justifyContent: 'center',
  minHeight: Styles.globalMargins.large,
  paddingBottom: Styles.globalMargins.tiny,
  paddingLeft: Styles.globalMargins.xlarge,
  paddingRight: Styles.globalMargins.xlarge,
  paddingTop: Styles.globalMargins.tiny,
  textAlign: 'center',
  width: '100%',
  zIndex: 1,
})

const styles = Styles.styleSheetCreate(() => ({
  bannerText: {
    color: Styles.globalColors.white,
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.white,
    flex: 1,
    position: 'relative',
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
}))

export default HeaderHoc(StandardScreen)
