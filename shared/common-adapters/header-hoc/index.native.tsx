import * as React from 'react'
import * as Styles from '@/styles'
import BackButton from '../back-button'
import Box from '@/common-adapters/box'
import BoxGrow from '@/common-adapters/box-grow'
import FloatingMenu from '@/common-adapters/floating-menu'
import Icon, {type IconType} from '@/common-adapters/icon'
import SafeAreaView, {SafeAreaViewTop} from '@/common-adapters/safe-area-view'
import Text from '@/common-adapters/text'
import {useNavigation} from '@react-navigation/native'
import type {Props, LeftActionProps} from '.'

const Kb = {BackButton, Box, BoxGrow, FloatingMenu, Icon, Text}

type RightAction = {
  label?: string
  icon?: IconType
  color?: string
  onPress: () => void
}

export const HeaderHocHeader = (props: Props) => {
  // TODO: remove these after updates are fully integrated
  const onLeftAction = props.onLeftAction || props.onBack || props.onCancel
  const leftAction = props.leftAction || (props.onCancel ? 'cancel' : props.onBack ? 'back' : undefined)
  const rightAction = props.onRightAction
    ? ({
        label: props.rightActionLabel,
        onPress: props.onRightAction,
      } as RightAction)
    : undefined

  // This is used to center the title. The magic numbers were calculated from the inspector.
  const actionWidth = Styles.isIOS ? 38 : 54
  const titlePaddingLeft = leftAction === 'cancel' ? 83 : 53 + (props.badgeNumber ? 23 : 0)
  const titlePadding = rightAction ? actionWidth : titlePaddingLeft

  const hasTextTitle = !!props.title && !props.titleComponent

  const header = (
    <Kb.Box
      style={Styles.collapseStyles([styles.header, props.borderless && styles.borderless, props.headerStyle])}
    >
      {props.customComponent}
      {hasTextTitle && (
        <Kb.Box
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
            {props.title}
          </Text>
        </Kb.Box>
      )}
      <LeftAction
        badgeNumber={props.badgeNumber}
        customCancelText={props.customCancelText}
        disabled={false}
        hasTextTitle={hasTextTitle}
        hideBackLabel={props.hideBackLabel}
        leftAction={leftAction}
        leftActionText={props.leftActionText}
        onLeftAction={onLeftAction}
        theme={props.theme}
      />
      {props.titleComponent && (
        <Kb.Box
          style={Styles.collapseStyles([
            styles.titleContainer,
            onLeftAction && styles.titleContainerRightPadding,
            rightAction && styles.titleContainerLeftPadding,
          ] as const)}
        >
          {props.titleComponent}
        </Kb.Box>
      )}
      {rightAction && <RightActions hasTextTitle={hasTextTitle} rightAction={rightAction} />}
    </Kb.Box>
  )

  return header
}

export const LeftAction = (p: LeftActionProps): React.ReactElement => {
  const {badgeNumber, disabled, customCancelText, hasTextTitle, hideBackLabel, leftAction} = p
  const {leftActionText, onLeftAction, theme, customIconColor, style} = p
  return (
    <Kb.Box style={Styles.collapseStyles([styles.leftAction, hasTextTitle && styles.grow, style])}>
      {onLeftAction && leftAction === 'cancel' ? (
        <Text type="BodyBigLink" style={styles.action} onClick={onLeftAction}>
          {leftActionText || customCancelText || 'Cancel'}
        </Text>
      ) : (
        (onLeftAction || leftAction === 'back') && (
          <Kb.BackButton
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
    </Kb.Box>
  )
}

const RightActions = (p: {hasTextTitle: boolean; rightAction: RightAction}) => {
  const {hasTextTitle, rightAction} = p
  return (
    <Kb.Box style={Styles.collapseStyles([styles.rightActions, hasTextTitle && styles.grow])}>
      <Kb.Box style={styles.rightActionsWrapper}>{renderAction(rightAction, 0)}</Kb.Box>
    </Kb.Box>
  )
}

const renderAction = (action: RightAction, index: number): React.ReactNode =>
  action.icon ? (
    <Kb.Icon key={action.label || index} onClick={action.onPress} style={styles.action} type={action.icon} />
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
    <Kb.Box style={styles.container}>
      {!!customSafeAreaTopStyle && <SafeAreaViewTop style={customSafeAreaTopStyle} />}
      {!skipHeader && <HeaderHocHeader {...props} />}
      <Kb.BoxGrow>{children}</Kb.BoxGrow>
      {!!customSafeAreaBottomStyle && <SafeAreaView style={customSafeAreaBottomStyle} />}
    </Kb.Box>
  )
}

// If layout is changed here, please make sure the Files header is updated as
// well to match this. fs/nav-header/mobile-header.js

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
    }) as const
)

const noop = () => {}
const HeaderLeftBlankImpl = React.memo(function HeaderLeftBlankImpl() {
  return <LeftAction badgeNumber={0} leftAction="back" onLeftAction={noop} style={{opacity: 0}} />
})
export const HeaderLeftBlank = () => <HeaderLeftBlankImpl />

export const HeaderLeftArrow = React.memo(function HeaderLeftArrow(hp: {
  canGoBack?: boolean
  badgeNumber?: number
  onPress?: () => void
  tintColor?: string
}) {
  const nav = useNavigation()
  return (hp.canGoBack ?? true) ? (
    <LeftAction
      badgeNumber={hp.badgeNumber ?? 0}
      leftAction="back"
      onLeftAction={nav.goBack}
      customIconColor={hp.tintColor}
    />
  ) : null
})

export const HeaderLeftArrowCanGoBack = React.memo(
  (hp: {canGoBack?: boolean; tintColor?: string; onPress?: () => void; badgeNumber?: number}) => {
    const canGoBack = useNavigation().canGoBack()
    return <HeaderLeftArrow {...hp} canGoBack={canGoBack} />
  }
)

export const HeaderLeftCancel = React.memo(function HeaderLeftCancel(hp: {
  canGoBack?: boolean
  badgeNumber?: number
  onPress: () => void
  tintColor: string
}) {
  const nav = useNavigation()
  return (hp.canGoBack ?? true) ? (
    <LeftAction
      badgeNumber={0}
      leftAction="cancel"
      onLeftAction={nav.goBack}
      customIconColor={hp.tintColor}
    />
  ) : null
})

export const HeaderLeftCancel2 = React.memo(function HeaderLeftCancel(hp: {
  canGoBack?: boolean
  badgeNumber?: number
  tintColor: string
}) {
  const nav = useNavigation()
  return (hp.canGoBack ?? true) ? (
    <LeftAction
      badgeNumber={0}
      leftAction="cancel"
      customIconColor={hp.tintColor}
      onLeftAction={nav.goBack}
    />
  ) : null
})
