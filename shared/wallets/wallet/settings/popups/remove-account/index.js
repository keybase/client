// @flow
import React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {WalletPopup} from '../../../../common'

export type Props = {|
  name: string,
  balance: string,
  onDelete: () => void,
  onClose: () => void,
|}

const RemoveAccountPopup = (props: Props) => {
  const buttons = [
    <Kb.Button
      fullWidth={Styles.isMobile}
      key={0}
      label="Cancel"
      onClick={props.onClose}
      type="Secondary"
      style={styles.button}
    />,
    <Kb.Button
      fullWidth={Styles.isMobile}
      key={1}
      label="Yes, remove"
      onClick={props.onDelete}
      type="Danger"
      style={styles.button}
    />,
  ]

  return (
    <WalletPopup
      onClose={props.onClose}
      headerStyle={styles.header}
      bottomButtons={Styles.isMobile ? buttons.reverse() : buttons}
    >
      <Kb.Icon
        type={Styles.isMobile ? 'icon-wallet-remove-64' : 'icon-wallet-remove-48'}
        style={Kb.iconCastPlatformStyles(styles.icon)}
      />
      <Kb.Text style={styles.warningText} type="Header">
        Are you sure you want to remove <Kb.Text type="HeaderItalic">{props.name}</Kb.Text> from Keybase?
      </Kb.Text>
      <Kb.Text type="BodySmall">Balance:</Kb.Text>
      <Kb.Text type="BodySmallExtrabold">{props.balance}</Kb.Text>
    </WalletPopup>
  )
}

const styles = Styles.styleSheetCreate({
  header: {
    borderBottomWidth: 0,
  },
  icon: Styles.platformStyles({
    common: {
      marginBottom: Styles.globalMargins.large,
    },
    isElectron: {
      marginTop: Styles.globalMargins.medium,
    },
    isMobile: {
      marginTop: Styles.globalMargins.xlarge,
    },
  }),
  warningText: Styles.platformStyles({
    common: {
      marginBottom: Styles.globalMargins.tiny,
      textAlign: 'center',
    },
    isElectron: {
      wordBreak: 'break-all',
    },
    isMobile: {
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,
    },
  }),
})

export default RemoveAccountPopup
