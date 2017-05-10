// @flow
import React from 'react'
import type {Props} from './standard-screen'
import {NativeScrollView} from './native-wrappers.native'
import Box from './box'
import Text from './text'
import HeaderHoc from './header-hoc'
import {globalColors, globalMargins, globalStyles} from '../styles'

const StandardScreen = (props: Props) => {
  return (
    <Box style={styleContainer}>
      <NativeScrollView>
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

const MIN_BANNER_HEIGHT = 40

const styleBanner = (type) => ({
  ...globalStyles.flexBoxColumn,
  minHeight: MIN_BANNER_HEIGHT,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
  marginBottom: globalMargins.tiny,
  marginTop: globalMargins.tiny,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: type === 'error' ? globalColors.red : globalColors.green,
})

const styleBannerText = {
  color: globalColors.white,
  textAlign: 'center',
}

const styleContentContainer = (isBannerShowing: boolean) => ({
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  flex: 1,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  ...(isBannerShowing ? {} : {marginTop: MIN_BANNER_HEIGHT}),
})

export default HeaderHoc(StandardScreen)
