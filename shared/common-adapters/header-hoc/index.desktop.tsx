import * as C from '@/constants'
import * as React from 'react'
import * as Styles from '@/styles'
import BackButton from '../back-button'
import Box from '@/common-adapters/box'
import Icon from '@/common-adapters/icon'
import Text from '@/common-adapters/text'
import type {Props, LeftActionProps} from '.'

const Kb = {BackButton, Box, Icon, Text}

export const HeaderHocHeader = ({
  headerStyle,
  customComponent,
  title,
  titleComponent,
  onCancel,
  rightActions,
  theme = 'light',
}: Props) => (
  <Kb.Box style={Styles.collapseStyles([_headerStyle, _headerStyleThemed[theme], headerStyle])}>
    {customComponent}
    {onCancel && (
      <Kb.Icon
        style={Styles.collapseStyles([_styleClose, _styleCloseThemed[theme]])}
        type="iconfont-close"
        onClick={onCancel}
      />
    )}
    {title && (
      <Kb.Box style={_titleStyle}>
        <Kb.Text type="Header">{title}</Kb.Text>
      </Kb.Box>
    )}
    {titleComponent}
    {(rightActions || []).map(a => (a ? a.custom : null))}
  </Kb.Box>
)

// TODO use LeftAction above
const LeftAction = ({
  badgeNumber,
  disabled,
  customCancelText,
  hasTextTitle,
  hideBackLabel,
  leftAction,
  leftActionText,
  onLeftAction,
  theme,
}: LeftActionProps) => (
  <Kb.Box style={Styles.collapseStyles([styles.leftAction, hasTextTitle && styles.grow])}>
    {onLeftAction && leftAction === 'cancel' ? (
      <Kb.Text type="BodyBigLink" style={styles.action} onClick={onLeftAction}>
        {leftActionText || customCancelText || 'Cancel'}
      </Kb.Text>
    ) : onLeftAction || leftAction === 'back' ? (
      <Kb.BackButton
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
        onClick={disabled ? undefined : onLeftAction}
      />
    ) : null}
  </Kb.Box>
)

export const HeaderHocWrapper = (props: Props & {children: React.ReactNode}) => {
  return props.children
}

const _headerStyle = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  justifyContent: 'flex-start',
  minHeight: undefined,
  paddingLeft: Styles.globalMargins.small,
  paddingRight: Styles.globalMargins.small,
  position: 'relative',
} as const

const _headerStyleThemed = {
  dark: {backgroundColor: Styles.globalColors.blueDarker2},
  light: {backgroundColor: Styles.globalColors.white},
}

const _styleClose = Styles.platformStyles({
  isElectron: {
    ...Styles.desktopStyles.clickable,
    position: 'absolute',
    right: Styles.globalMargins.small,
    top: Styles.globalMargins.small,
  },
})

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
} as const

const styles = Styles.styleSheetCreate(() => ({
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
}))

const noop = () => {}
export const HeaderLeftBlank = () => (
  <LeftAction badgeNumber={0} leftAction="back" onLeftAction={noop} style={{opacity: 0}} />
)

export const HeaderLeftArrow = (hp: {
  canGoBack?: boolean
  tintColor?: string
  onPress?: () => void
  badgeNumber?: number
}) =>
  hp.canGoBack ? (
    <LeftAction
      badgeNumber={hp.badgeNumber ?? 0}
      leftAction="back"
      onLeftAction={hp.onPress} // react navigation makes sure this onPress can only happen once
      customIconColor={hp.tintColor}
    />
  ) : null

export const HeaderLeftCancel = (hp: {canGoBack?: boolean; tintColor?: string; onPress?: () => void}) =>
  hp.canGoBack ? (
    <LeftAction
      badgeNumber={0}
      leftAction="cancel"
      onLeftAction={hp.onPress} // react navigation makes sure this onPress can only happen once
      customIconColor={hp.tintColor}
    />
  ) : null

export const HeaderLeftCancel2 = (hp: {canGoBack?: boolean; tintColor?: string}) => {
  const {pop} = C.useNav()
  return hp.canGoBack ?? true ? (
    <LeftAction badgeNumber={0} leftAction="cancel" customIconColor={hp.tintColor} onLeftAction={pop} />
  ) : null
}
