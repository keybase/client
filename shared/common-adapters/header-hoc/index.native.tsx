import * as React from 'react'
import Text from '../text'
import BackButton from '../back-button'
import Box from '../box'
import FloatingMenu from '../floating-menu'
import Icon from '../icon'
import SafeAreaView, {SafeAreaViewTop} from '../safe-area-view'
import * as Styles from '../../styles'
import type {Action, Props, LeftActionProps} from '.'
import {useNavigation} from '@react-navigation/core'

const MAX_RIGHT_ACTIONS = 3

type State = {
  floatingMenuVisible: boolean
}

export class HeaderHocHeader extends React.Component<Props, State> {
  state = {
    floatingMenuVisible: false,
  }
  _hideFloatingMenu = () => this.setState({floatingMenuVisible: false})
  _showFloatingMenu = () => this.setState({floatingMenuVisible: true})
  render() {
    // TODO: remove these after updates are fully integrated
    const onLeftAction = this.props.onLeftAction || this.props.onBack || this.props.onCancel
    const leftAction =
      this.props.leftAction || (this.props.onCancel ? 'cancel' : this.props.onBack ? 'back' : null)
    const rightActions = this.props.rightActions
      ? this.props.rightActions.filter(Boolean)
      : this.props.onRightAction && this.props.rightActionLabel
      ? [
          {
            label: this.props.rightActionLabel,
            onPress: this.props.onRightAction,
          },
        ]
      : []

    // This is used to center the title. The magic numbers were calculated from the inspector.
    const actionWidth = Styles.isIOS ? 38 : 54
    const titlePaddingLeft = leftAction === 'cancel' ? 83 : 53 + (this.props.badgeNumber ? 23 : 0)
    const titlePadding = rightActions.length
      ? actionWidth * (rightActions.length > MAX_RIGHT_ACTIONS ? MAX_RIGHT_ACTIONS : rightActions.length)
      : titlePaddingLeft

    const hasTextTitle = !!this.props.title && !this.props.titleComponent

    const header = (
      <Box
        style={Styles.collapseStyles([
          styles.header,
          this.props.borderless && styles.borderless,
          this.props.headerStyle,
        ])}
      >
        {this.props.customComponent}
        {hasTextTitle && (
          <Box
            style={Styles.collapseStyles([
              styles.titleContainer,
              styles.titleTextContainer,
              Styles.isIOS && {
                paddingLeft: titlePadding,
                paddingRight: titlePadding,
              },
              Styles.isAndroid && {
                paddingLeft: onLeftAction ? titlePaddingLeft : Styles.globalMargins.small,
                paddingRight: titlePadding,
              },
            ])}
          >
            <Text type="BodyBig" style={styles.title} lineClamp={1}>
              {this.props.title}
            </Text>
          </Box>
        )}
        <LeftAction
          badgeNumber={this.props.badgeNumber}
          customCancelText={this.props.customCancelText}
          disabled={false}
          hasTextTitle={hasTextTitle}
          hideBackLabel={this.props.hideBackLabel}
          leftAction={leftAction}
          leftActionText={this.props.leftActionText}
          onLeftAction={onLeftAction || null}
          theme={this.props.theme}
        />
        {this.props.titleComponent && (
          <Box
            style={Styles.collapseStyles([
              styles.titleContainer,
              onLeftAction && styles.titleContainerRightPadding,
              rightActions.length && styles.titleContainerLeftPadding,
            ] as const)}
          >
            {this.props.titleComponent}
          </Box>
        )}
        <RightActions
          floatingMenuVisible={this.state.floatingMenuVisible}
          hasTextTitle={hasTextTitle}
          hideFloatingMenu={this._hideFloatingMenu}
          rightActions={rightActions}
          showFloatingMenu={this._showFloatingMenu}
        />
      </Box>
    )

    return header
  }
}

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
  customIconColor,
  style,
}: LeftActionProps): React.ReactElement => (
  <Box style={Styles.collapseStyles([styles.leftAction, hasTextTitle && styles.grow, style])}>
    {onLeftAction && leftAction === 'cancel' ? (
      <Text type="BodyBigLink" style={styles.action} onClick={onLeftAction}>
        {leftActionText || customCancelText || 'Cancel'}
      </Text>
    ) : (
      (onLeftAction || leftAction === 'back') && (
        <BackButton
          badgeNumber={badgeNumber}
          hideBackLabel={hideBackLabel}
          iconColor={
            customIconColor ||
            (disabled
              ? Styles.globalColors.black_10
              : theme === 'dark'
              ? Styles.globalColors.white
              : Styles.globalColors.black_50)
          }
          style={styles.action}
          onClick={onLeftAction ?? undefined}
        />
      )
    )}
  </Box>
)

const RightActions = (p: {
  floatingMenuVisible: boolean
  hasTextTitle: boolean
  hideFloatingMenu: () => void
  rightActions: Props['rightActions']
  showFloatingMenu: () => void
}) => {
  const {floatingMenuVisible, hasTextTitle, hideFloatingMenu, rightActions, showFloatingMenu} = p
  return (
    <Box style={Styles.collapseStyles([styles.rightActions, hasTextTitle && styles.grow])}>
      <Box style={styles.rightActionsWrapper}>
        {rightActions
          ?.slice(0, rightActions.length <= MAX_RIGHT_ACTIONS ? MAX_RIGHT_ACTIONS : MAX_RIGHT_ACTIONS - 1)
          .map((action, index) => (action ? renderAction(action, index) : null))}
        <RightActionsOverflow
          floatingMenuVisible={floatingMenuVisible}
          hideFloatingMenu={hideFloatingMenu}
          rightActions={rightActions}
          showFloatingMenu={showFloatingMenu}
        />
      </Box>
    </Box>
  )
}

const RightActionsOverflow = (p: {
  floatingMenuVisible: boolean
  hideFloatingMenu: () => void
  rightActions: Props['rightActions']
  showFloatingMenu: () => void
}) => {
  const {floatingMenuVisible, hideFloatingMenu, rightActions, showFloatingMenu} = p
  return rightActions && rightActions.length > MAX_RIGHT_ACTIONS ? (
    <>
      <Icon onClick={showFloatingMenu} style={styles.action} type="iconfont-ellipsis" />
      <FloatingMenu
        visible={floatingMenuVisible}
        items={rightActions.slice(MAX_RIGHT_ACTIONS - 1).map(action => ({
          onClick: action?.onPress,
          title: action?.label || 'You need to specify a label', // TODO: remove this after updates are fully integrated
        }))}
        onHidden={hideFloatingMenu}
        position="bottom left"
        closeOnSelect={true}
      />
    </>
  ) : null
}

const renderAction = (action: Action, index: number): React.ReactNode =>
  action.custom ? (
    <Box key={action.label || index} style={styles.action}>
      {action.custom}
    </Box>
  ) : action.icon ? (
    <Icon
      color={action.iconColor || undefined}
      key={action.label || index}
      onClick={action.onPress}
      style={styles.action}
      type={action.icon}
    />
  ) : (
    <Text
      key={action.label}
      type="BodyBigLink"
      style={Styles.collapseStyles([styles.action, action.color && {color: action.color}])}
      onClick={action.onPress}
    >
      {action.label}
    </Text>
  )

/** TODO likely deprecate this **/
export const HeaderHocWrapper = (props: Props & {children: React.ReactNode; skipHeader?: boolean}) => {
  const {customSafeAreaTopStyle, children, customSafeAreaBottomStyle, skipHeader} = props
  return (
    <Box style={styles.container}>
      {!!customSafeAreaTopStyle && <SafeAreaViewTop style={customSafeAreaTopStyle} />}
      {!skipHeader && <HeaderHocHeader {...props} />}
      <Box style={styles.grow}>
        <Box style={styles.innerWrapper}>{children}</Box>
      </Box>
      {!!customSafeAreaBottomStyle && <SafeAreaView style={customSafeAreaBottomStyle} />}
    </Box>
  )
}

// If layout is changed here, please make sure the Files header is updated as
// well to match this. fs/nav-header/mobile-header.js

const styles = Styles.styleSheetCreate(() => ({
  action: Styles.platformStyles({
    common: {
      opacity: 1,
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: 0,
      paddingRight: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
    },
    isAndroid: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
    isIOS: {
      paddingLeft: Styles.globalMargins.tiny,
    },
  }),
  actionPressable: {opacity: 0.3},
  borderless: {borderBottomWidth: 0},
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    height: '100%',
    position: 'relative',
  },
  grow: {flexGrow: 1},
  header: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      borderBottomColor: Styles.globalColors.black_10,
      borderBottomWidth: 1,
      borderStyle: 'solid',
      justifyContent: 'flex-start',
    },
    isAndroid: {
      backgroundColor: Styles.globalColors.white,
      height: 56,
    },
    isIOS: {height: 44},
    isTablet: {
      height: 40 + Styles.headerExtraHeight,
    },
  }),
  innerWrapper: {...Styles.globalStyles.fillAbsolute},
  leftAction: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'flex-start',
      flexShrink: 1,
      justifyContent: 'flex-start',
    },
  }),
  rightActions: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'flex-end',
      flexShrink: 1,
      justifyContent: 'flex-end',
    },
    isIOS: {paddingRight: Styles.globalMargins.tiny},
  }),
  rightActionsWrapper: {...Styles.globalStyles.flexBoxRow},
  title: {color: Styles.globalColors.black},
  titleContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      flexGrow: 1,
      flexShrink: 2,
      justifyContent: 'center',
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  titleContainerLeftPadding: Styles.platformStyles({
    isAndroid: {paddingLeft: Styles.globalMargins.small},
  }),
  titleContainerRightPadding: Styles.platformStyles({
    isAndroid: {paddingRight: Styles.globalMargins.small},
  }),
  titleTextContainer: {...Styles.globalStyles.fillAbsolute},
}))

const noop = () => {}
export const HeaderLeftBlank = React.memo(
  function HeaderLeftBlank() {
    return <LeftAction badgeNumber={0} leftAction="back" onLeftAction={noop} style={{opacity: 0}} />
  },
  () => true
)

export const HeaderLeftArrow = React.memo(function HeaderLeftArrow(hp: {
  canGoBack?: boolean
  badgeNumber?: number
  onPress: () => void
  tintColor: string
}) {
  return hp.canGoBack ?? true ? (
    <LeftAction
      badgeNumber={hp.badgeNumber ?? 0}
      leftAction="back"
      onLeftAction={hp.onPress} // react navigation makes sure this onPress can only happen once
      customIconColor={hp.tintColor}
    />
  ) : null
})

export const HeaderLeftCancel = React.memo(function HeaderLeftCancel(hp: {
  canGoBack?: boolean
  badgeNumber?: number
  onPress: () => void
  tintColor: string
}) {
  return hp.canGoBack ?? true ? (
    <LeftAction
      badgeNumber={0}
      leftAction="cancel"
      onLeftAction={hp.onPress} // react navigation makes sure this onPress can only happen once
      customIconColor={hp.tintColor}
    />
  ) : null
})

export const HeaderLeftCancel2 = React.memo(function HeaderLeftCancel(hp: {
  canGoBack?: boolean
  badgeNumber?: number
  tintColor: string
}) {
  const navigation = useNavigation()
  const onBack = React.useCallback(() => {
    // @ts-ignore
    navigation.pop()
  }, [navigation])

  return hp.canGoBack ?? true ? (
    <LeftAction badgeNumber={0} leftAction="cancel" customIconColor={hp.tintColor} onLeftAction={onBack} />
  ) : null
})
