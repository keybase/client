// @flow
import React from 'react'
import type {Props} from './standard-screen'
import {Box, Text} from './'
import {globalColors, globalMargins, globalStyles} from '../styles/style-guide'

const StandardScreen = (props: Props) => {
  return (
    <Box style={{...styleContainer, ...props.styleOuter}}>
      <Box style={styleCloseContainer}>
        {!!props.onClose && <Text type='BodyPrimaryLink' style={{...styleClose, ...props.styleClose}} onClick={props.onClose}>{props.onCloseText || 'Cancel'}</Text>}
      </Box>
      {!!props.notification &&
        <Box style={{...styleBanner(props.notification.type), ...props.styleBanner}}>
          {typeof props.notification.message === 'string' ? <Text style={styleBannerText} type='BodySmallSemibold'>{props.notification.message}</Text> : props.notification.message}
        </Box>}
      <Box style={{...styleContentContainer(!!props.notification), ...props.style}}>
        {props.children}
      </Box>
    </Box>
  )
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  padding: globalMargins.small,
  flex: 1,
}

const styleCloseContainer = {
  ...globalStyles.flexBoxRow,
  height: globalMargins.large - globalMargins.tiny,
  alignItems: 'center',
}

const styleClose = {
  color: globalColors.blue,
}

const MIN_BANNER_HEIGHT = globalMargins.large

const styleBanner = (type) => ({
  ...globalStyles.flexBoxColumn,
  minHeight: MIN_BANNER_HEIGHT,
  padding: globalMargins.tiny,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: type === 'error' ? globalColors.red : globalColors.green,
})

const styleBannerText = {
  color: globalColors.white,
  textAlign: 'center',
}

const styleContentContainer = (isBannerShowing) => ({
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  ...(isBannerShowing ? {marginTop: -MIN_BANNER_HEIGHT} : {}),
})

export default StandardScreen
