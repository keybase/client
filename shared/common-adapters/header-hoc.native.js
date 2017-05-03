// @flow
import React from 'react'
import Text from './text'
import {StyleSheet} from 'react-native'
import BackButton from './back-button'
import Box from './box'
import {globalStyles, globalColors, globalMargins, statusBarHeight} from '../styles'

import type {Props} from './header-hoc'

function HeaderHoc<P> (WrappedComponent: ReactClass<P>) {
  return ({onBack, onCancel, headerStyle, title, ...restProps}: Props & P) => (
    <Box style={_containerStyle}>
      <Box style={{..._headerStyle, ...headerStyle}}>
        <Box style={_titleStyle}>
          <Text type='Header'>{title}</Text>
        </Box>
        {onCancel && <Text type='BodyBigLink' onClick={onCancel}>Cancel</Text>}
        {onBack && <BackButton iconStyle={_backButtonIconStyle} onClick={onBack} />}
      </Box>
      <WrappedComponent {...restProps} onBack={onBack} onCancel={onCancel} />
    </Box>
  )
}

const _backButtonIconStyle = {
  color: globalColors.blue,
}

const _containerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const _headerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: StyleSheet.hairlineWidth,
  justifyContent: 'flex-start',
  marginTop: statusBarHeight,
  minHeight: globalMargins.xlarge - statusBarHeight,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  position: 'relative',
}

const _titleStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  bottom: 0,
  flex: 1,
  justifyContent: 'center',
  left: 0,
  position: 'absolute', // This is always centered so we never worry about items to the left/right. If you have overlap or other issues you likely have to fix the content
  right: 0,
  top: 0,
}

export default HeaderHoc
