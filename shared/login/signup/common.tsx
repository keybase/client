import * as C from '@/constants'
import type * as React from 'react'
import * as Kb from '@/common-adapters'
import {styleSheetCreate, isMobile, globalMargins, globalColors} from '@/styles'

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
      gap={isMobile ? 'xtiny' : 'small'}
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
      waitingKey={C.Signup.waitingKey}
      label={label || 'Continue'}
      disabled={disabled}
      fullWidth={true}
      onClick={onClick}
    />
  </Kb.ButtonBar>
)

const styles = styleSheetCreate(
  () =>
    ({
      avatar: {marginBottom: isMobile ? globalMargins.xtiny : 0},
      buttonBar: {maxWidth: 460, padding: 0, paddingTop: globalMargins.medium},
      header: {
        backgroundColor: globalColors.transparent,
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
      wrapper: {paddingLeft: globalMargins.medium, paddingRight: globalMargins.medium},
    }) as const
)
