// @flow
import * as React from 'react'
import Text from './text'
import {StyleSheet} from 'react-native'
import BackButton from './back-button'
import Box from './box'
import * as Styles from '../styles'
import type {Props} from './header-hoc.types'

export const HeaderHocHeader = ({
  headerStyle,
  customComponent,
  hideBackLabel,
  title,
  onCancel,
  customCancelText,
  onBack,
  onRightAction,
  rightActionLabel,
  theme = 'light',
}: Props) => (
  <Box style={Styles.collapseStyles([_headerStyle, _headerStyleThemed[theme], headerStyle])}>
    {customComponent}
    {!!title && (
      <Box style={_titleStyle}>
        <Text type="BodyBig">{title}</Text>
      </Box>
    )}
    {onCancel && (
      <Text type="BodyBigLink" style={_buttonStyle} onClick={onCancel}>
        {customCancelText || 'Cancel'}
      </Text>
    )}
    {onBack && (
      <BackButton
        hideBackLabel={hideBackLabel}
        iconColor={_backButtonIconColorThemed[theme]}
        style={_buttonStyle}
        onClick={onBack}
      />
    )}
    {!!rightActionLabel && (
      <Box style={_rightActionStyle}>
        <Text
          type="BodyBigLink"
          style={Styles.collapseStyles([_buttonStyle, {opacity: onRightAction ? 1 : 0.3}])}
          onClick={onRightAction}
        >
          {rightActionLabel}
        </Text>
      </Box>
    )}
  </Box>
)

function HeaderHoc<P: {}>(WrappedComponent: React.ComponentType<P>) {
  const HeaderHocWrapper = (props: P & Props) => (
    <Box style={_containerStyle}>
      <HeaderHocHeader {...props} />
      <Box style={_wrapperStyle}>
        <Box style={_wrapper2Style}>
          <WrappedComponent {...(props: P)} />
        </Box>
      </Box>
    </Box>
  )

  return HeaderHocWrapper
}

const _backButtonIconColorThemed = {
  dark: Styles.globalColors.white,
  light: Styles.globalColors.black_40,
}

const _containerStyle = {
  ...Styles.globalStyles.flexBoxColumn,
  position: 'relative',
  height: '100%',
  width: '100%',
}

const _wrapper2Style = {
  ...Styles.globalStyles.fillAbsolute,
}

const _wrapperStyle = {
  flexGrow: 1,
}

const _buttonStyle = {
  paddingBottom: 8,
  paddingLeft: Styles.globalMargins.small,
  paddingRight: Styles.globalMargins.small,
  paddingTop: 8,
}

const _headerStyle = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  borderBottomColor: Styles.globalColors.black_10,
  borderBottomWidth: StyleSheet.hairlineWidth,
  justifyContent: 'flex-start',
  minHeight: Styles.globalMargins.xlarge - Styles.statusBarHeight,
  paddingRight: Styles.globalMargins.small,
  position: 'relative',
}

const _headerStyleThemed = {
  dark: {
    backgroundColor: Styles.globalColors.darkBlue3,
  },
  light: {
    backgroundColor: Styles.globalColors.white,
  },
}

const _rightActionStyle = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'flex-end',
  bottom: 0,
  flex: 1,
  justifyContent: 'flex-end',
  position: 'absolute', // This is always right-aligned
  right: 0,
  top: 0,
}

const _titleStyle = {
  ...Styles.globalStyles.flexBoxRow,
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
