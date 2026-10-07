import * as React from 'react'
import * as Kb from '@/common-adapters'

type Props = {
  body: React.ReactNode
  checkboxLabel: React.ReactNode
  // on mobile the confirm button always reads "Confirm"
  confirmLabel: string
  icon: React.ReactNode
  onCancel: () => void
  onConfirm: () => void
}

// destructive-settings warning: icon, body, an "I understand" checkbox gating the confirm button.
// The route's title asks the question.
const ConfirmWarning = (props: Props) => {
  const {body, checkboxLabel, confirmLabel, icon, onCancel, onConfirm} = props
  const styles = useStyles()
  const [enabled, setEnabled] = React.useState(false)
  return (
    <Kb.ModalScreen
      centered={true}
      footer={
        <Kb.ConfirmButtons
          onCancel={onCancel}
          onConfirm={onConfirm}
          confirmLabel={isMobile ? 'Confirm' : confirmLabel}
          confirmType="Danger"
          confirmDisabled={!enabled}
          split={true}
        />
      }
    >
      <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} gap="small" style={styles.container}>
        {icon}
        <Kb.Text center={true} type="Body">
          {body}
        </Kb.Text>
        <Kb.Checkbox
          checked={enabled}
          onCheck={setEnabled}
          label=""
          labelComponent={
            <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.label}>
              {checkboxLabel}
            </Kb.Box2>
          }
        />
      </Kb.Box2>
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  container: {paddingTop: Kb.Styles.globalMargins.small},
  label: {flexShrink: 1},
}))

export default ConfirmWarning
