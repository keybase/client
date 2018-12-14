// @flow
import * as React from 'react'
import type {Props} from './standard-screen'
import {NativeScrollView} from './native-wrappers.native'
import Box from './box'
import Text from './text'
import HeaderHoc from './header-hoc'
import {globalColors, globalMargins, globalStyles} from '../styles'

const StandardScreen = ({theme = 'light', ...props}: Props) => {
  return (
    <Box style={{...styleContainer, ...backgroundColorThemed[theme]}}>
      <NativeScrollView scrollEnabled={props.scrollEnabled}>
        {!!props.notification && (
          <Box style={{...styleBanner(props.notification.type), ...props.styleBanner}}>
            {typeof props.notification.message === 'string' ? (
              <Text style={styleBannerText} type="BodySmallSemibold">
                {props.notification.message}
              </Text>
            ) : (
              props.notification.message
            )}
          </Box>
        )}
        <Box style={{...styleContentContainer(!!props.notification), ...props.style}}>{props.children}</Box>
      </NativeScrollView>
    </Box>
  )
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  flexGrow: 1,
}

const MIN_BANNER_HEIGHT = 40

const backgroundColorThemed = {
  dark: {
    backgroundColor: globalColors.darkBlue3,
  },
  light: {
    backgroundColor: globalColors.white,
  },
}

const styleBanner = type => ({
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: type === 'error' ? globalColors.red : globalColors.green,
  justifyContent: 'center',
  marginBottom: globalMargins.tiny,
  minHeight: MIN_BANNER_HEIGHT,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
})

const styleBannerText = {
  color: globalColors.white,
  textAlign: 'center',
}

const styleContentContainer = (isBannerShowing: boolean) => ({
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  ...(isBannerShowing ? {marginTop: MIN_BANNER_HEIGHT} : {}),
})

export default HeaderHoc(StandardScreen)
