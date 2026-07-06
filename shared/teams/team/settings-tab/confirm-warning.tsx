import * as React from 'react'
import * as Kb from '@/common-adapters'

type Props = {
  body: React.ReactNode
  checkboxLabel: React.ReactNode
  // on mobile the confirm button always reads "Confirm"
  confirmLabel: string
  icon: React.ReactNode
  header: React.ReactNode
  onCancel: () => void
  onConfirm: () => void
}

// destructive-settings warning: icon, header, body, an "I understand" checkbox
// gating the confirm button
const ConfirmWarning = (props: Props) => {
  const [enabled, setEnabled] = React.useState(false)

  return (
    <Kb.Box2 direction="vertical" alignItems="center" style={styles.container}>
      <Kb.Box2 direction="vertical" style={styles.iconBox}>
        {props.icon}
      </Kb.Box2>
      <Kb.Text center={true} type="Header" style={styles.header}>
        {props.header}
      </Kb.Text>
      <Kb.Text center={true} type="Body" style={styles.body}>
        {props.body}
      </Kb.Text>
      <Kb.Checkbox
        checked={enabled}
        onCheck={setEnabled}
        style={styles.checkbox}
        label=""
        labelComponent={
          <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.label}>
            {props.checkboxLabel}
          </Kb.Box2>
        }
      />
      <Kb.ConfirmButtons
        onCancel={props.onCancel}
        onConfirm={props.onConfirm}
        confirmLabel={isMobile ? 'Confirm' : props.confirmLabel}
        confirmType="Danger"
        confirmDisabled={!enabled}
      />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  body: {marginBottom: Kb.Styles.globalMargins.small},
  checkbox: Kb.Styles.platformStyles({
    isElectron: {
      marginBottom: Kb.Styles.globalMargins.xlarge,
    },
    isMobile: {
      marginBottom: Kb.Styles.globalMargins.small,
    },
  }),
  container: Kb.Styles.platformStyles({
    common: {
      paddingBottom: Kb.Styles.globalMargins.large,
    },
    isElectron: {
      paddingLeft: Kb.Styles.globalMargins.xlarge,
      paddingRight: Kb.Styles.globalMargins.xlarge,
      paddingTop: Kb.Styles.globalMargins.xlarge,
    },
    isMobile: {
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
      paddingTop: Kb.Styles.globalMargins.small,
    },
  }),
  header: {marginBottom: Kb.Styles.globalMargins.small},
  iconBox: {marginBottom: 20},
  label: {flexShrink: 1},
}))

export default ConfirmWarning
