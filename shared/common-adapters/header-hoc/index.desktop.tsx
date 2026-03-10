import * as C from '@/constants'
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
  <Kb.Box2 direction="vertical" alignItems="flex-start" style={Styles.collapseStyles([styles.leftAction, hasTextTitle && styles.grow])}>
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
  </Kb.Box2>
)

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
      flexShrink: 1,
      justifyContent: 'flex-start',
    },
    isIOS: {
      paddingLeft: Styles.globalMargins.tiny,
    },
  }),
}))

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

export const HeaderLeftArrowCanGoBack = (hp: {
  canGoBack?: boolean
  tintColor?: string
  onPress?: () => void
  badgeNumber?: number
}) => {
  const canGoBack = useNavigation().canGoBack()
  return <HeaderLeftArrow {...hp} canGoBack={canGoBack} />
}

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
  return (hp.canGoBack ?? true) ? (
    <LeftAction badgeNumber={0} leftAction="cancel" customIconColor={hp.tintColor} onLeftAction={pop} />
  ) : null
}
