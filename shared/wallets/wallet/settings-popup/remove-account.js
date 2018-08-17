// @flow
import React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import WalletModal from '../../wallet-modal'

export type Props = {
  name: string,
  currency: string,
  keys: string,
  onDelete: () => void,
  onClose: () => void,
}

const RemoveAccountDialog = (props: Props) => (
  <WalletModal
    onClose={props.onClose}
    bottomButtons={[
      <Kb.Button key={0} label="Cancel" onClick={props.onClose} type="Secondary" style={styles.button} />,
      <Kb.Button key={1} label="Yes, remove" onClick={props.onDelete} type="Danger" style={styles.button} />,
    ]}
  >
    <Kb.Icon
      type={Styles.isMobile ? 'icon-wallet-remove-64' : 'icon-wallet-remove-48'}
      style={Kb.iconCastPlatformStyles(styles.icon)}
    />
    <Kb.Text style={styles.warningText} type="Header">
      Are you sure you want to remove <Kb.Text type="HeaderItalic">{props.name}</Kb.Text> from Keybase?
    </Kb.Text>
    <Kb.Text type="BodySmall">Balance:</Kb.Text>
    <Kb.Text type="BodySmallExtrabold">{props.currency}</Kb.Text>
    <Kb.Text type="BodySmallExtrabold">{props.keys}</Kb.Text>
  </WalletModal>
)

const styles = Styles.styleSheetCreate({
  icon: {
    marginBottom: Styles.globalMargins.large,
  },
  warningText: {
    marginBottom: Styles.globalMargins.tiny,
    textAlign: 'center',
  },
})

export default RemoveAccountDialog
