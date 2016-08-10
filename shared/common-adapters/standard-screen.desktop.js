// @flow
import React from 'react'
import {Box, Text, Icon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import type {Props, NotificationType} from './standard-screen'

const StandardScreen = (props: Props) => {
  return (
    <Box style={{...styleContainer, ...props.styleOuter}}>
      {!!props.onClose && <Icon style={{...styleClose, ...props.styleClose}} type='iconfont-close' onClick={props.onClose} />}
      {!!props.notification && <Box style={{...styleBanner(props.notification.type), ...props.styleBanner}}>
        {typeof props.notification.message === 'string'
          ? <Text style={styleBannerText} type='BodySmallSemibold'>{props.notification.message}</Text>
          : props.notification.message
        }
      </Box>}
      <Box style={{...styleContentContainer, ...props.style}}>
        {props.children}
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
