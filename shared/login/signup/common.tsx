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
      waitingKey={C.waitingKey}
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
      avatar: {marginBottom: Kb.Styles.isMobile ? Kb.Styles.globalMargins.xtiny : 0},
      buttonBar: {maxWidth: 460, padding: 0, paddingTop: Kb.Styles.globalMargins.medium},
      header: {
        backgroundColor: Kb.Styles.globalColors.transparent,
        borderBottomWidth: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      input: {maxWidth: 460, width: '100%'},
      inputContainer: {alignItems: 'center', alignSelf: 'stretch'},
      inputErrorStyle: {minHeight: 0},
      inputInnerStyle: {width: '100%'},
      wrapper: {paddingLeft: Kb.Styles.globalMargins.medium, paddingRight: Kb.Styles.globalMargins.medium},
    }) as const
)
