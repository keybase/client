import type * as React from 'react'
import * as Styles from '@/styles'
import BackButton from '../back-button'
import {Box2} from '@/common-adapters/box'
import Text from '@/common-adapters/text'
import {useNavigation} from '@react-navigation/native'
const Kb = {BackButton, Box2, Text}

type LeftActionProps = {
  badgeNumber?: number
  disabled?: boolean
  customCancelText?: string
  hasTextTitle?: boolean
  hideBackLabel?: boolean
  leftAction?: 'back' | 'cancel'
  leftActionText?: string
  theme?: 'light' | 'dark'
  onLeftAction?: () => void
  customIconColor?: string
  style?: Styles.StylesCrossPlatform
}

const LeftAction = (p: LeftActionProps): React.ReactElement => {
  const {badgeNumber, disabled, customCancelText, hasTextTitle, hideBackLabel, leftAction} = p
  const {leftActionText, onLeftAction, theme, customIconColor, style} = p
  return (
    <Kb.Box2 direction="vertical" alignItems="flex-start" style={Styles.collapseStyles([styles.leftAction, hasTextTitle && styles.grow, style])}>
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
    </Kb.Box2>
  )
}

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
      grow: {flexGrow: 1},
      leftAction: Styles.platformStyles({
        common: {
          flexShrink: 1,
          justifyContent: 'flex-start',
        },
      }),
    }) as const
)

export function HeaderLeftArrow(hp: {
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
}

export function HeaderLeftArrowCanGoBack(hp: {
  canGoBack?: boolean
  tintColor?: string
  onPress?: () => void
  badgeNumber?: number
}) {
  const canGoBack = useNavigation().canGoBack()
  return <HeaderLeftArrow {...hp} canGoBack={canGoBack} />
}

export function HeaderLeftCancel(hp: {
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
}

export function HeaderLeftCancel2(hp: {
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
}
