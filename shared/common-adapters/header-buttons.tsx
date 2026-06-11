import * as Styles from '@/styles'
import BackButton from '@/common-adapters/back-button'
import {Box2} from '@/common-adapters/box'
import Text from '@/common-adapters/text'
import {useNavigation} from '@react-navigation/native'
import type {HeaderOptions} from '@react-navigation/elements'
import type {GetOptionsRet} from '@/constants/types/router'

export type HeaderBackButtonProps = Parameters<NonNullable<HeaderOptions['headerLeft']>>[0]

const Kb = {BackButton, Box2, Text}

const LeftAction = (p: {
  badgeNumber: number
  mode: 'back' | 'cancel'
  onAction: () => void
  iconColor?: string
}) => (
  <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.leftAction}>
    {p.mode === 'cancel' ? (
      <Text type="BodyBigLink" style={styles.action} onClick={p.onAction}>
        Cancel
      </Text>
    ) : (
      <Kb.BackButton
        badgeNumber={p.badgeNumber}
        iconColor={p.iconColor ?? Styles.globalColors.black_50}
        style={styles.action}
        onClick={p.onAction}
      />
    )}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  action: Styles.platformStyles({
    common: {
      opacity: 1,
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0),
    },
    isAndroid: {
      ...Styles.paddingH(Styles.globalMargins.small),
    },
    isElectron: {
      paddingLeft: Styles.globalMargins.tiny,
    },
    isIOS: {
      paddingLeft: Styles.globalMargins.tiny,
    },
  }),
  leftAction: Styles.platformStyles({
    common: {
      flexShrink: 1,
      justifyContent: 'flex-start',
    },
  }),
  rightAction: Styles.platformStyles({
    common: {
      flexShrink: 1,
      justifyContent: 'flex-end',
    },
  }),
}))

export function HeaderLeftButton(hp: HeaderBackButtonProps & {
  badgeNumber?: number
  mode?: 'back' | 'cancel'
  autoDetectCanGoBack?: boolean
}) {
  const nav = useNavigation()
  const canGoBack = hp.autoDetectCanGoBack ? nav.canGoBack() : (hp.canGoBack ?? true)
  if (!canGoBack) return null
  return (
    <LeftAction
      badgeNumber={hp.badgeNumber ?? 0}
      mode={hp.mode ?? 'back'}
      onAction={hp.onPress ?? nav.goBack}
      iconColor={hp.tintColor as string | undefined}
    />
  )
}

export function HeaderRightButton(hp: {onPress?: () => void}) {
  const nav = useNavigation()
  return (
    <Kb.Box2 direction="vertical" alignItems="flex-end" style={styles.rightAction}>
      <Text type="BodyBigLink" style={styles.action} onClick={hp.onPress ?? nav.goBack}>
        Done
      </Text>
    </Kb.Box2>
  )
}

// Modals that are info-only / viewers / live-apply dismiss with a right-side "Done"
// (iOS convention). The modal group injects a left "Cancel" by default, so we also
// clear the left slot here. The right slot uses a plain headerRight component on every
// platform (HeaderRightButton dismisses via useNavigation); iOS only treats the left
// slot specially, so clearing it needs unstable_headerLeftItems there.
// headerShown is mobile-only: on desktop the root navigator hides React Navigation's
// header and ModalWrapper draws its own from these options; forcing headerShown there
// would render both.
export const doneModalOptions = (title: string): NonNullable<GetOptionsRet> => ({
  ...(isIOS ? {unstable_headerLeftItems: () => []} : {headerLeft: () => null}),
  headerRight: () => <HeaderRightButton />,
  ...(isMobile ? {headerBackVisible: false, headerShown: true} : {}),
  title,
})
