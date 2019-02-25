// @flow
import * as React from 'react'
import Text from '../text'
import BackButton from '../back-button'
import Box from '../box'
import Icon from '../icon'
import * as Styles from '../../styles'
import type {Props, LeftActionProps} from './types'
import flags from '../../util/feature-flags'

export const HeaderHocHeader = ({
  headerStyle,
  customComponent,
  hideBackLabel,
  title,
  titleComponent,
  onCancel,
  onBack,
  rightActions,
  theme = 'light',
}: Props) => (
  <Box style={Styles.collapseStyles([_headerStyle, _headerStyleThemed[theme], headerStyle])}>
    {customComponent}
    {onBack && !flags.useNewRouter && (
      <BackButton
        key="back"
        hideBackLabel={hideBackLabel}
        onClick={onBack}
        style={{..._backButtonIconStyle, ..._backButtonIconStyleThemed[theme]}}
      />
    )}
    {onCancel && (
      <Icon
        style={Styles.collapseStyles([_styleClose, _styleCloseThemed[theme]])}
        type="iconfont-close"
        onClick={onCancel}
      />
    )}
    {title && (
      <Box style={_titleStyle}>
        <Text type="Header">{title}</Text>
      </Box>
    )}
    {titleComponent}
    {(rightActions || []).map(a => (a ? a.custom : null))}
  </Box>
)

// TODO use LeftAction above
export const LeftAction = ({
  badgeNumber,
  disabled,
  customCancelText,
  hasTextTitle,
  hideBackLabel,
  leftAction,
  leftActionText,
  onLeftAction,
  theme,
}: LeftActionProps): React.Node => (
  <Box style={Styles.collapseStyles([styles.leftAction, hasTextTitle && styles.grow])}>
    {onLeftAction &&
      (leftAction === 'cancel' ? (
        <Text type="BodyBigLink" style={styles.action} onClick={onLeftAction}>
          {leftActionText || customCancelText || 'Cancel'}
        </Text>
      ) : (
        <BackButton
          badgeNumber={badgeNumber}
          hideBackLabel={hideBackLabel}
          iconColor={
            disabled
              ? Styles.globalColors.black_10
              : theme === 'dark'
              ? Styles.globalColors.white
              : Styles.globalColors.black_50
          }
          style={styles.action}
          textStyle={disabled ? styles.disabledText : undefined}
          onClick={disabled ? null : onLeftAction}
        />
      ))}
  </Box>
)

function HeaderHoc<P: {}>(WrappedComponent: React.ComponentType<P>) {
  return (props: P & Props) =>
    flags.useNewRouter ? (
      <WrappedComponent {...(props: P)} />
    ) : (
      <Box style={_containerStyle}>
        <HeaderHocHeader {...props} />
        <WrappedComponent {...(props: P)} />
      </Box>
    )
}

const _containerStyle = {
  ...Styles.globalStyles.flexBoxColumn,
  flex: 1,
}

const _headerStyle = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  justifyContent: 'flex-start',
  minHeight: flags.useNewRouter ? undefined : 48,
  paddingLeft: Styles.globalMargins.small,
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

const _backButtonIconStyle = {
  position: 'absolute',
}

const _backButtonIconStyleThemed = {
  dark: {
    color: Styles.globalColors.white,
  },
  light: {
    color: Styles.globalColors.black_50,
  },
}

const _styleClose = {
  ...Styles.desktopStyles.clickable,
  position: 'absolute',
  right: Styles.globalMargins.small,
  top: Styles.globalMargins.small,
}

const _styleCloseThemed = {
  dark: {
    color: Styles.globalColors.white_40,
  },
  light: {
    color: Styles.globalColors.black_20,
  },
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

const styles = Styles.styleSheetCreate({
  action: Styles.platformStyles({
    common: {
      opacity: 1,
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
  disabledText: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.black_50,
    },
  }),
  grow: {
    flexGrow: 1,
  },
  leftAction: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'flex-start',
      flexShrink: 1,
      justifyContent: 'flex-start',
    },
    isIOS: {
      paddingLeft: Styles.globalMargins.tiny,
    },
  }),
})

export default HeaderHoc
