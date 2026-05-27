import * as Styles from '@/styles'
import BackButton from '@/common-adapters/back-button'
import {Box2} from '@/common-adapters/box'
import Text from '@/common-adapters/text'
import {useNavigation} from '@react-navigation/native'
import type {HeaderOptions} from '@react-navigation/elements'

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
