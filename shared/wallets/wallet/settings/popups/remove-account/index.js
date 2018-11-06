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
    <Kb.Button fullWidth={Styles.isMobile} key={0} label="Cancel" onClick={props.onClose} type="Secondary" />,
    <Kb.Button
      fullWidth={Styles.isMobile}
      key={1}
      label="Yes, remove"
      onClick={props.onDelete}
      type="Danger"
    />,
  ]

  return (
    <WalletPopup
      onExit={props.onClose}
      backButtonType="cancel"
      headerStyle={styles.header}
      bottomButtons={Styles.isMobile ? buttons.reverse() : buttons}
    >
      <Kb.Icon
        type={Styles.isMobile ? 'icon-wallet-remove-64' : 'icon-wallet-remove-48'}
        style={Kb.iconCastPlatformStyles(styles.icon)}
      />
      <Kb.Text style={styles.warningText} type="Header">
        Are you sure you want to remove{' '}
      </Kb.Text>
      <Kb.Text type="HeaderItalic" style={styles.warningText}>
        {props.name}
      </Kb.Text>
      <Kb.Text style={Styles.collapseStyles([styles.warningText, styles.marginBottomTiny])} type="Header">
        {' '}
        from Keybase?
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
  marginBottomTiny: {
    marginBottom: Styles.globalMargins.tiny,
  },
  warningText: Styles.platformStyles({
    common: {
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
