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
    return Styles.isMobile ? 'icon-email-remove-64' : 'icon-email-remove-48'
  }
  return Styles.isMobile ? 'icon-phone-number-remove-64' : 'icon-phone-number-remove-48'
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

const styles = Styles.styleSheetCreate({
  icon: Styles.platformStyles({
    isElectron: {
      height: 48,
      width: 48,
    },
    isMobile: {
      height: 64,
      width: 64,
    },
  }),
})

export default ConfirmDeleteAddress
