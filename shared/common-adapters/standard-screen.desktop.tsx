import * as React from 'react'
import Box from './box'
import Text from './text'
import HeaderHoc from './header-hoc'
import {globalStyles, globalColors, globalMargins, desktopStyles, collapseStyles} from '../styles'
import {Props, NotificationType} from './standard-screen'

const StandardScreen = ({theme = 'light', ...props}: Props) => {
  const topStack = [
    !!props.notification && (
      <Box key="banner" style={{...styleBanner(props.notification.type), ...props.styleBanner}}>
        {typeof props.notification.message === 'string' ? (
          <Text style={styleBannerText} type="BodySmallSemibold">
            {props.notification.message}
          </Text>
        ) : (
          props.notification.message
        )}
      </Box>
    ),
  ]
  const topStackCount = topStack.reduce((acc, x) => acc + (x ? 1 : 0), 0)
  return (
    <Box style={{...styleContainer, ...backgroundColorThemed[theme]}}>
      <Box style={styleTopStack}>{topStack}</Box>
      <Box style={{...styleInnerContainer, paddingBottom: topStackCount * globalMargins.large}}>
        <Box style={collapseStyles([styleContentContainer, props.style])}>{props.children}</Box>
      </Box>
    </Box>
  )
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  ...desktopStyles.scrollable,
  alignItems: 'stretch',
  flex: 1,
  position: 'relative',
}

const styleTopStack = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  position: 'relative',
  width: '100%',
}

const backgroundColorThemed = {
  dark: {
    backgroundColor: globalColors.blueDarker2,
  },
  light: {
    backgroundColor: globalColors.white,
  },
}

const styleBanner = (notificationType: NotificationType) => ({
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: notificationType === 'error' ? globalColors.red : globalColors.green,
  justifyContent: 'center',
  minHeight: globalMargins.large,
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.xlarge,
  paddingRight: globalMargins.xlarge,
  paddingTop: globalMargins.tiny,
  textAlign: 'center',
  width: '100%',
  zIndex: 1,
})

const styleBannerText = {
  color: globalColors.white,
}

const styleInnerContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  position: 'relative',
}

const styleContentContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
  margin: globalMargins.large,
  textAlign: 'center',
}

export default HeaderHoc(StandardScreen)
