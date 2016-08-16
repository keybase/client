// @flow
import React from 'react'
import {ScrollView} from 'react-native'
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
      <ScrollView style={styleScrollContainer(!!props.notification)} contentContainerStyle={{...styleContentContainer, ...props.style}}>
        {props.children}
      </ScrollView>
    </Box>
  )
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const styleCloseContainer = {
  ...globalStyles.flexBoxRow,
  marginLeft: globalMargins.small,
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

const styleScrollContainer = (isBannerShowing: boolean) => ({
  ...(isBannerShowing ? {marginTop: -MIN_BANNER_HEIGHT} : {}),
})

const styleContentContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  flex: 1,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
}

export default StandardScreen
