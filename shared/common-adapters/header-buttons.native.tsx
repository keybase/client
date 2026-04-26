import type * as React from 'react'
import * as Styles from '@/styles'
import BackButton from './back-button'
import {Box2} from '@/common-adapters/box'
import Text from '@/common-adapters/text'
import {useNavigation} from '@react-navigation/native'
const Kb = {BackButton, Box2, Text}

const LeftAction = (p: {
  badgeNumber: number
  mode: 'back' | 'cancel'
  onAction: () => void
  iconColor?: string | undefined
}): React.ReactElement => (
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
      leftAction: Styles.platformStyles({
        common: {
          flexShrink: 1,
          justifyContent: 'flex-start',
        },
      }),
    }) as const
)

export function HeaderLeftButton(hp: {
  canGoBack?: boolean | undefined
  badgeNumber?: number | undefined
  onPress?: (() => void) | undefined
  tintColor?: string | undefined
  mode?: 'back' | 'cancel' | undefined
  autoDetectCanGoBack?: boolean | undefined
}) {
  const nav = useNavigation()
  const canGoBack = hp.autoDetectCanGoBack ? nav.canGoBack() : (hp.canGoBack ?? true)
  if (!canGoBack) return null
  return (
    <LeftAction
      badgeNumber={hp.badgeNumber ?? 0}
      mode={hp.mode ?? 'back'}
      onAction={nav.goBack}
      iconColor={hp.tintColor}
    />
  )
}
