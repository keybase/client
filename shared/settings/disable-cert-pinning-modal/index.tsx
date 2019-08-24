import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  onCancel: () => void
  onConfirm: () => void
}

const ConfirmDisableCertPinningModal = (props: Props) => (
  <Kb.ConfirmModal
    confirmText="Yes, I am sure"
    description="This means your proxy or your ISP will be able to view all
        traffic between you and Keybase servers. It is not recommended to use this option unless absolutely required."
    header={<Kb.Icon type="iconfont-exclamation" sizeType="Big" color={Styles.globalColors.red} />}
    onCancel={props.onCancel}
    onConfirm={props.onConfirm}
    prompt={`Are you sure you want to allow TLS MITM?`}
  />
)

export default ConfirmDisableCertPinningModal
