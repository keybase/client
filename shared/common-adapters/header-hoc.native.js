// @flow
import React from 'react'
import Text from './text'
import {StyleSheet} from 'react-native'
import BackButton from './back-button'
import Box from './box'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {Props} from './header-hoc'

const HeaderHoc = WrappedComponent => ({onBack, title, ...restProps}: Props) => (
  <Box style={containerStyle}>
    <Box style={headerStyle}>
      <Box style={backButtonStyle}>
        {onBack && <BackButton style={backButtonStyle} iconStyle={backButtonIconStyle} onClick={onBack} />}
      </Box>
      <Text type='Header' style={headerText}>{title}</Text>
    </Box>
    {<WrappedComponent {...restProps} />}
  </Box>
)

const backButtonMarginLeft = globalMargins.small
const backButtonWidth = 40

const backButtonStyle = {
  marginLeft: backButtonMarginLeft,
  paddingBottom: 2,
  width: backButtonWidth,
}

const backButtonIconStyle = {
  color: globalColors.blue,
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const headerStyle = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'center',
  alignItems: 'center',
  borderBottomWidth: StyleSheet.hairlineWidth,
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
  borderBottomColor: globalColors.black_05,
}

const headerText = {
  marginRight: backButtonMarginLeft + backButtonWidth,
  textAlign: 'center',
  flex: 1,
}

export default HeaderHoc
