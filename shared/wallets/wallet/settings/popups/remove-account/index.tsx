import React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {WalletPopup} from '../../../../common'

export type Props = {
  name: string
  balance: string
  onDelete: () => void
  onClose: () => void
}

const RemoveAccountPopup = (props: Props) => {
  const buttons = [
    <Kb.Button fullWidth={Styles.isMobile} key={0} label="Cancel" onClick={props.onClose} type="Dim" />,
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
      safeAreaViewBottomStyle={styles.safeAreaBottom}
    >
      <Kb.Box2 centerChildren={true} direction="vertical" style={styles.flexOne} fullWidth={true}>
        <Kb.Icon
          type={Styles.isMobile ? 'icon-wallet-remove-64' : 'icon-wallet-remove-48'}
          style={Kb.iconCastPlatformStyles(styles.icon)}
        />
        <Kb.Text center={true} style={styles.warningText} type="Header">
          This removes{' '}
        </Kb.Text>
        <Kb.Text center={true} type="HeaderItalic" style={styles.warningText}>
          {props.name}
        </Kb.Text>
        <Kb.Text
          center={true}
          style={Styles.collapseStyles([styles.warningText, styles.marginBottomTiny])}
          type="Header"
        >
          {' '}
          from Keybase, but you can still use it elsewhere if you save the private key.
        </Kb.Text>
        <Kb.Text type="BodySmall">Balance:</Kb.Text>
        <Kb.Text type="BodySmallExtrabold">{props.balance}</Kb.Text>
      </Kb.Box2>
    </WalletPopup>
  )
}

const styles = Styles.styleSheetCreate({
  flexOne: {flex: 1},
  header: {borderBottomWidth: 0},
  icon: Styles.platformStyles({
    common: {marginBottom: Styles.globalMargins.large},
    isElectron: {marginTop: Styles.globalMargins.medium},
    isMobile: {marginTop: Styles.globalMargins.xlarge},
  }),
  marginBottomTiny: {marginBottom: Styles.globalMargins.tiny},
  safeAreaBottom: {
    backgroundColor: Styles.globalColors.fastBlank,
  },
  warningText: Styles.platformStyles({
    isElectron: {wordBreak: 'break-word'},
    isMobile: {
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    },
  }),
})

export default RemoveAccountPopup
