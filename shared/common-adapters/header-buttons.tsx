import * as React from 'react'
import * as Styles from '@/styles'
import BackButton from '@/common-adapters/back-button'
import {Box2} from '@/common-adapters/box'
import Text from '@/common-adapters/text'
import {useNavigation} from '@react-navigation/native'
import type {HeaderOptions} from '@react-navigation/elements'
import type {NativeStackHeaderItem} from '@react-navigation/native-stack'
import type {SFSymbol} from 'sf-symbols-typescript'
import type {GetOptionsRet} from '@/constants/types/router'
import {navigateUp} from '@/constants/router'
import {useModalHeaderState} from '@/stores/modal-header'

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

// Native UIBarButtonItems (unstable_header*Items) keep their liquid glass containers
// stable across push transitions on iOS 26 — custom React views in headerLeft/headerRight
// are re-created per screen and slide in with it. Prefer these on iOS wherever the button
// is a plain label or SF Symbol.
export const nativeHeaderItemLabelStyle = () => ({
  color: Styles.globalColors.blueDark,
  fontFamily: 'Keybase',
  fontSize: 17,
  fontWeight: '600',
})

export const nativeTextHeaderItem = (
  label: string,
  onPress: () => void,
  opts?: Partial<Extract<NativeStackHeaderItem, {type: 'button'}>>
): NativeStackHeaderItem => ({
  label,
  labelStyle: nativeHeaderItemLabelStyle(),
  onPress,
  type: 'button',
  ...opts,
})

export const nativeIconHeaderItem = (
  name: SFSymbol,
  label: string,
  onPress: () => void,
  opts?: Partial<Extract<NativeStackHeaderItem, {type: 'button'}>>
): NativeStackHeaderItem => ({
  icon: {name, type: 'sfSymbol'},
  label,
  onPress,
  tintColor: Styles.globalColors.black_50,
  type: 'button',
  ...opts,
})

export const nativeBackHeaderItem = (onPress?: () => void): NativeStackHeaderItem =>
  nativeIconHeaderItem('chevron.backward', 'Back', onPress ?? navigateUp)

export const nativeCancelHeaderItem = (onPress?: () => void): NativeStackHeaderItem =>
  nativeTextHeaderItem('Cancel', onPress ?? navigateUp)

// For modal screens whose left action is a plain back: iOS uses a native bar button item
// (stable glass), other platforms keep the custom button.
export const modalBackLeftOptions: NonNullable<GetOptionsRet> = isIOS
  ? {unstable_headerLeftItems: () => [nativeBackHeaderItem()]}
  : {headerLeft: HeaderLeftButton}

// Drives a modal's header action button from the mounted screen body. Publishes to
// ModalHeaderStore (Android/desktop render it via headerRight/headerTitle components)
// and on iOS also pushes a native bar button item so the glass container stays stable
// across pushes. The screen's route options must not set headerRight on iOS.
export const useModalHeaderAction = (p: {
  enabled?: boolean
  label: string
  onAction?: () => void
  title?: string
  waiting?: boolean
}) => {
  const {enabled = true, label, onAction, title = '', waiting = false} = p
  const navigation = useNavigation()
  React.useEffect(() => {
    useModalHeaderState.setState({actionEnabled: enabled, actionWaiting: waiting, onAction, title})
    if (isIOS) {
      navigation.setOptions({
        unstable_headerRightItems: onAction
          ? () => [nativeTextHeaderItem(label, onAction, {disabled: !enabled || waiting})]
          : () => [],
      } as object)
    }
    return () => {
      useModalHeaderState.setState({actionEnabled: false, actionWaiting: false, onAction: undefined, title: ''})
      if (isIOS) {
        navigation.setOptions({unstable_headerRightItems: undefined} as object)
      }
    }
  }, [enabled, label, navigation, onAction, title, waiting])
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
  ...(isIOS
    ? {
        unstable_headerLeftItems: () => [],
        unstable_headerRightItems: () => [nativeTextHeaderItem('Done', navigateUp)],
      }
    : {headerLeft: () => null, headerRight: () => <HeaderRightButton />}),
  ...(isMobile ? {headerBackVisible: false, headerShown: true} : {}),
  title,
})
