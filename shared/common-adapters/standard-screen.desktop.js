// @flow
import React from 'react'
import {Box, Text, Icon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import type {Props, NotificationType} from './standard-screen'

const StandardScreen = ({children, onClose, notification, style}: Props) => {
  return (
    <Box style={styleContainer}>
      {!!onClose && <Icon style={styleClose} type='iconfont-close' onClick={onClose} />}
      {!!notification && <Box style={styleBanner(notification.type)}>
        {typeof notification.message === 'string'
          ? <Text style={styleBannerText} type='BodySmallSemibold'>{notification.message}</Text>
          : notification.message
        }
      </Box>}
      <Box style={{...styleContentContainer, ...style}}>
        {children}
      </Box>
    </Box>
  )
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.scrollable,
  flex: 1,
  alignItems: 'center',
  position: 'relative',
  paddingTop: globalMargins.large,
  paddingBottom: globalMargins.large,
}

const styleClose = {
  ...globalStyles.clickable,
  position: 'absolute',
  top: globalMargins.small,
  right: globalMargins.small,
  color: globalColors.black_10,
}

const styleBanner = (notificationType: NotificationType) => ({
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
  zIndex: 1,
  height: globalMargins.large,
  marginTop: -globalMargins.large,
  backgroundColor: notificationType === 'error'
    ? globalColors.red
    : globalColors.green,
})

const styleBannerText = {
  color: globalColors.white,
}

const styleContentContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  margin: globalMargins.large,
  textAlign: 'center',
}

export default StandardScreen
