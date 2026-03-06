import type * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'

type Props = {
  children: React.ReactNode
  onBack: () => void
}

export const Wrapper = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      centerChildren={true}
      style={styles.wrapper}
      gap={Kb.Styles.isMobile ? 'xtiny' : 'small'}
    >
      {props.children}
    </Kb.Box2>
  </Kb.Box2>
)

export const ContinueButton = ({
  disabled,
  label,
  onClick,
}: {
  disabled?: boolean
  label?: string
  onClick: () => void
}) => (
  <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
    <Kb.WaitingButton
      waitingKey={C.waitingKeySignup}
      label={label || 'Continue'}
      disabled={disabled}
      fullWidth={true}
      onClick={onClick}
    />
  </Kb.ButtonBar>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      buttonBar: {maxWidth: 460, padding: 0, paddingTop: Kb.Styles.globalMargins.medium},
      wrapper: {paddingLeft: Kb.Styles.globalMargins.medium, paddingRight: Kb.Styles.globalMargins.medium},
    }) as const
)
