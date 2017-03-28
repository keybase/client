// @flow
import React from 'react'
import Text from './text'
import {StyleSheet} from 'react-native'
import BackButton from './back-button'
import Box from './box'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {Props} from './header-hoc'

function HeaderHoc<P> (WrappedComponent: ReactClass<P>) {
  return ({onBack, onCancel, headerStyle, title, ...restProps}: Props & P) => (
    <Box style={_containerStyle}>
      <Box style={{..._headerStyle, ...headerStyle}}>
        {onCancel &&
        <Box style={_cancelStyle}>
          <Text type='BodyBigLink' onClick={onCancel}>Cancel</Text>
        </Box>}
        {onBack &&
        <Box style={_backButtonStyle}>
          <BackButton iconStyle={_backButtonIconStyle} onClick={onBack} />
        </Box>}
        <Text type='Header' style={_headerText}>{title}</Text>
      </Box>
      {<WrappedComponent {...restProps} />}
    </Box>
  )
}

const backButtonMarginLeft = globalMargins.small
const backButtonWidth = 40

const _cancelStyle = {
  marginLeft: backButtonMarginLeft,
}

const _backButtonStyle = {
  marginLeft: backButtonMarginLeft,
  paddingBottom: 2,
  width: backButtonWidth,
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
  justifyContent: 'center',
  alignItems: 'center',
  borderBottomWidth: StyleSheet.hairlineWidth,
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
  borderBottomColor: globalColors.black_05,
}

const _headerText = {
  marginRight: backButtonMarginLeft + backButtonWidth,
  textAlign: 'center',
  flex: 1,
}

export default HeaderHoc
