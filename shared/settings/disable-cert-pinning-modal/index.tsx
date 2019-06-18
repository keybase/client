import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  onCancel: () => void
  onConfirm: () => void
}

const ConfirmDisableCertPinningModal = (props: Props) => (
  <Kb.Box style={styles.modal}>
    <Kb.Text center={true} type="Header" style={styles.header}>
      Are you sure you want to allow TLS MITM? This means your proxy will be able to view all traffic between
      you and Keybase servers. It is not recommended to use this option unless absolutely required.
    </Kb.Text>
    <Kb.ButtonBar>
      <Kb.Button type="Dim" label="Cancel" onClick={props.onCancel} />
      <Kb.Button type="Danger" label="Yes, I am sure" onClick={props.onConfirm} />
    </Kb.ButtonBar>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate({
  header: {
    marginTop: Styles.globalMargins.medium,
    width: 320,
  },
  modal: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: Styles.globalMargins.medium,
  },
})

export default ConfirmDisableCertPinningModal
