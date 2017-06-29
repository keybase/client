// @flow
import React from 'react'
import Text from './text'
import {StyleSheet} from 'react-native'
import BackButton from './back-button'
import Box from './box'
import {globalStyles, globalColors, globalMargins, statusBarHeight} from '../styles'

import type {Props} from './header-hoc'

function HeaderHoc<P>(WrappedComponent: ReactClass<P>) {
  const HeaderHocWrapper = ({
    onBack,
    onCancel,
    headerStyle,
    title,
    theme = 'light',
    ...restProps
  }: Props & P) => (
    <Box style={_containerStyle}>
      <Box style={{..._headerStyle, ..._headerStyleThemed[theme], ...headerStyle}}>
        <Box style={_titleStyle}>
          <Text type="Header">{title}</Text>
        </Box>
        {onCancel && <Text type="BodyBigLink" style={_buttonStyle} onClick={onCancel}>Cancel</Text>}
        {onBack &&
          <BackButton iconStyle={_backButtonIconStyleThemed[theme]} style={_buttonStyle} onClick={onBack} />}
      </Box>
      <WrappedComponent {...restProps} theme={theme} onBack={onBack} onCancel={onCancel} />
    </Box>
  )

  return HeaderHocWrapper
}

const _backButtonIconStyleThemed = {
  dark: {
    color: globalColors.white,
  },
  light: {
    color: globalColors.black_40,
  },
}

const _containerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const _buttonStyle = {
  paddingBottom: 8,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  paddingTop: 8,
}

const _headerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: StyleSheet.hairlineWidth,
  justifyContent: 'flex-start',
  minHeight: globalMargins.xlarge - statusBarHeight,
  paddingRight: globalMargins.small,
  position: 'relative',
}

const _headerStyleThemed = {
  dark: {
    backgroundColor: globalColors.darkBlue3,
  },
  light: {
    backgroundColor: globalColors.white,
  },
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
