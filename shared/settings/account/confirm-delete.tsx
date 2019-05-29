import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  address: string
  onCancel: () => void
  onConfirm: () => void
  type: 'email' | 'phone'
}

const getIcon = props => {
  if (props.type === 'email') {
    return Styles.isMobile ? 'icon-email-delete-64' : 'icon-email-delete-48'
  }
  return Styles.isMobile ? 'icon-number-delete-64' : 'icon-number-delete-48'
}

const ConfirmDeleteAddress = (props: Props) => (
  <Kb.ConfirmModal
    icon={getIcon(props)}
    prompt={`Delete ${props.type === 'email' ? 'address' : 'number'} \n${props.address}?`}
    description={`Your friends will no longer be able to find you by this ${
      props.type === 'email' ? 'email address' : 'number'
    }.`}
    onCancel={props.onCancel}
    onConfirm={props.onConfirm}
  />
)

export default ConfirmDeleteAddress
