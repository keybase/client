// @flow
import React from 'react'
import Text from './text'
import BackButton from './back-button'
import Box from './box'
import Icon from './icon'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {Props} from './header-hoc'

function HeaderHoc<P> (WrappedComponent: ReactClass<P>) {
  return ({onBack, onCancel, headerStyle, title, theme = 'light', ...restProps}: Props & P) => (
    <Box style={_containerStyle}>
      <Box style={{..._headerStyle, ..._headerStyleThemed[theme], ...headerStyle}}>
        {onBack && <BackButton key='back' onClick={onBack} style={{..._backButtonIconStyle, ..._backButtonIconStyleThemed[theme]}} />}
        {onCancel && <Icon style={{..._styleClose, ..._styleCloseThemed[theme]}} type='iconfont-close' onClick={onCancel} />}
        {title &&
        <Box style={_titleStyle}>
          <Text type='Header'>{title}</Text>
        </Box>}
      </Box>
      <WrappedComponent {...restProps} theme={theme} onBack={onBack} onCancel={onCancel} />
    </Box>
  )
}

const _containerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const _headerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'flex-start',
  minHeight: 48,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  position: 'relative',
}

const _headerStyleThemed = {
  'dark': {
    backgroundColor: globalColors.darkBlue3,
  },
  'light': {
    backgroundColor: globalColors.white,
  },
}

const _backButtonIconStyle = {
  position: 'absolute',
}

const _backButtonIconStyleThemed = {
  'dark': {
    color: globalColors.white,
  },
  'light': {
    color: globalColors.black_40,
  },
}

const _styleClose = {
  ...globalStyles.clickable,
  position: 'absolute',
  right: globalMargins.small,
  top: globalMargins.small,
}

const _styleCloseThemed = {
  'dark': {
    color: globalColors.white_40,
  },
  'light': {
    color: globalColors.black_20,
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
