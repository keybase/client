// @flow
import React from 'react'
import {ScrollView} from 'react-native'
import type {Props} from './standard-screen'
import {Box, Text} from './'
import {globalColors, globalMargins, globalStyles} from '../styles'

const StandardScreen = (props: Props) => {
  return (
    <Box style={{...styleContainer, ...props.styleOuter}}>
      <Box style={styleCloseContainer}>
        {!!props.onClose && <Text type='BodyPrimaryLink' style={{...styleClose, ...props.styleClose}} onClick={props.onClose}>{props.onCloseText || 'Cancel'}</Text>}
      </Box>
      <ScrollView style={styleScrollContainer} contentContainerStyle={styleScrollContainer}>
        {!!props.notification &&
          <Box style={{...styleBanner(props.notification.type), ...props.styleBanner}}>
            {typeof props.notification.message === 'string' ? <Text style={styleBannerText} type='BodySmallSemibold'>{props.notification.message}</Text> : props.notification.message}
          </Box>}
        <Box style={{...styleContentContainer(!!props.notification), ...props.style}}>
          {props.children}
        </Box>
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

const styleScrollContainer = {
  flex: 1,
}

const styleContentContainer = (isBannerShowing: boolean) => ({
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  flex: 1,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  paddingBottom: globalMargins.small,
  ...(isBannerShowing ? {} : {marginTop: MIN_BANNER_HEIGHT}),
})

export default StandardScreen
