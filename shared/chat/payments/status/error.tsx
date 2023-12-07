import * as React from 'react'
import {Box2} from '@/common-adapters/box'
import type {MeasureRef} from '@/common-adapters/measure-ref'
import Divider from '@/common-adapters/divider'
import Text from '@/common-adapters/text'
import * as Styles from '@/styles'
import FloatingMenu, {type MenuItems} from '@/common-adapters/floating-menu'

// This is actually a dependency of common-adapters/markdown so we have to treat it like a common-adapter, no * import allowed
const Kb = {
  Box2,
  Divider,
  FloatingMenu,
  Styles,
  Text,
}

type Props = {
  attachTo?: React.RefObject<MeasureRef>
  onHidden: () => void
  error: string
  visible: boolean
}

const items: MenuItems = []

const PaymentStatusError = (props: Props) => {
  const header = (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Text type="BodyExtrabold" style={styles.headerError}>
        Failed to send payment
      </Kb.Text>
      <Kb.Divider />
      <Kb.Box2 style={styles.errorContainer} direction="vertical" centerChildren={true} fullWidth={true}>
        <Kb.Text type="BodySemibold" style={styles.bodyError}>
          {props.error}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )

  return (
    <Kb.FloatingMenu
      attachTo={props.attachTo}
      closeOnSelect={true}
      header={header}
      items={items}
      onHidden={props.onHidden}
      visible={props.visible}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bodyError: Kb.Styles.platformStyles({
        common: {color: Kb.Styles.globalColors.redDark, textAlign: 'center'},
        isElectron: {
          wordBreak: 'break-word',
        } as const,
      }),
      errorContainer: Kb.Styles.platformStyles({
        common: {
          padding: Kb.Styles.globalMargins.small,
        },
        isElectron: {
          maxWidth: 200,
          minHeight: 100,
        },
      }),
      headerError: {
        alignSelf: 'center',
        color: Kb.Styles.globalColors.redDark,
        padding: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)

export default PaymentStatusError
