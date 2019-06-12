import * as React from 'react'
import * as Kb from '../../common-adapters'
import {globalStyles} from "../../styles";
import {globalMargins} from "../../styles";

export type Props = {
  onCancel: () => void
  onConfirm: () => void
}

class ConfirmDisableCertPinningModal extends React.Component<Props> {
  render() {
    return (
        <Kb.Box
            style={{
                ...globalStyles.flexBoxColumn,
                alignItems: 'center',
                flex: 1,
                justifyContent: 'center',
                padding: globalMargins.medium,
            }}
        >
            <Kb.Text center={true} type="Header" style={{marginTop: globalMargins.medium, width: 320}}>
                Are you sure you want to allow TLS MITM? This means your proxy will be able to view all traffic
                between you and Keybase servers. It is not recommended to use this option unless absolutely required.
            </Kb.Text>
            <Kb.ButtonBar>
                <Kb.Button type="Dim" label="Cancel" onClick={this.props.onCancel} />
                <Kb.Button type="Danger" label="Yes, I am sure" onClick={this.props.onConfirm} />
            </Kb.ButtonBar>
        </Kb.Box>
    )
  }
}
export default ConfirmDisableCertPinningModal
