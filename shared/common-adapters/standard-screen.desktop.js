// @flow
import React from 'react'
import {Box, Text, HeaderHoc} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'
import type {Props, NotificationType} from './standard-screen'

const StandardScreen = ({theme = 'light', ...props}: Props) => {
  const topStack = [
    !!props.notification && (<Box key='banner' style={{...styleBanner(props.notification.type), ...props.styleBanner}}>
      {typeof props.notification.message === 'string'
        ? <Text style={styleBannerText} type='BodySemibold'>{props.notification.message}</Text>
        : props.notification.message
      }
    </Box>),
  ]
  const topStackCount = topStack.reduce((acc, x) => acc + !!x, 0)
  return (
    <Box style={{...styleContainer, ...backgroundColorThemed[theme]}}>
      <Box style={styleTopStack}>
        {topStack}
      </Box>
      <Box style={{...styleInnerContainer, paddingBottom: topStackCount * globalMargins.large}}>
        <Box style={{...styleContentContainer, ...props.style}}>
          {props.children}
        </Box>
      </Box>
    </Box>
  )
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.scrollable,
  flex: 1,
  alignItems: 'stretch',
  position: 'relative',
}

const styleTopStack = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
  alignItems: 'stretch',
  width: '100%',
}

const backgroundColorThemed = {
  'light': {
    backgroundColor: globalColors.white,
  },
  'dark': {
    backgroundColor: globalColors.darkBlue3,
  },
}

const styleBanner = (notificationType: NotificationType) => ({
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
  paddingLeft: globalMargins.xlarge,
  paddingRight: globalMargins.xlarge,
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
  textAlign: 'center',
  zIndex: 1,
  minHeight: globalMargins.large,
  backgroundColor: notificationType === 'error'
    ? globalColors.red
    : globalColors.green,
})

const styleBannerText = {
  color: globalColors.white,
}

const styleInnerContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  alignItems: 'center',
  position: 'relative',
}

const styleContentContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  margin: globalMargins.large,
  textAlign: 'center',
}

export default HeaderHoc(StandardScreen)
