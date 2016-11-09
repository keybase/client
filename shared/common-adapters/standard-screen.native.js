// @flow
import React from 'react'
import type {Props} from './standard-screen'
import {NativeScrollView} from './native-wrappers.native'
import Box from './box'
import Icon from './icon'
import Text from './text'
import {globalColors, globalMargins, globalStyles} from '../styles'

const StandardScreen = (props: Props) => {
  return (
    <Box style={{...styleContainer, ...props.styleOuter}}>
      <Box style={styleCloseContainer}>
        {!!props.onClose && <Text type='BodyBig' style={{...styleClose, ...props.styleClose}} onClick={props.onClose}>Cancel</Text>}
        {!!props.onBack && <Icon type='iconfont-back' style={{...styleClose, ...backArrowStyle, ...props.styleBack}} onClick={props.onBack} />}
      </Box>
      <NativeScrollView style={styleScrollContainer} contentContainerStyle={styleScrollContainer}>
        {!!props.notification &&
          <Box style={{...styleBanner(props.notification.type), ...props.styleBanner}}>
            {typeof props.notification.message === 'string' ? <Text style={styleBannerText} type='BodySemibold'>{props.notification.message}</Text> : props.notification.message}
          </Box>}
        <Box style={{...styleContentContainer(!!props.notification), ...props.style}}>
          {props.children}
        </Box>
      </NativeScrollView>
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

const backArrowStyle = {
  fontSize: 24,
}

const styleClose = {
  color: globalColors.blue,
}

const MIN_BANNER_HEIGHT = 48

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
