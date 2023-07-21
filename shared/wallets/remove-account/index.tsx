import * as Constants from '../../constants/wallets'
import * as RouterConstants from '../../constants/router2'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import WalletPopup from '../wallet-popup'

type OwnProps = {accountID: string}

export default (ownProps: OwnProps) => {
  const {accountID} = ownProps
  const account = Constants.useState(s => s.accountMap.get(accountID))
  const balance = account?.balanceDescription ?? 'Error loading account'
  const name = account?.name ?? ''
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onClose = () => {
    navigateUp()
  }
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onDelete = () => {
    navigateAppend({props: {accountID}, selected: 'reallyRemoveAccount'}, true)
  }

  const buttons = [
    <Kb.Button fullWidth={Styles.isMobile} key={0} label="Cancel" onClick={onClose} type="Dim" />,
    <Kb.Button
      fullWidth={Styles.isMobile}
      key={1}
      label="Yes, remove"
      onClick={onDelete}
      type="Danger"
      disabled={!account}
    />,
  ]

  return (
    <WalletPopup
      onExit={onClose}
      backButtonType="cancel"
      headerStyle={styles.header}
      bottomButtons={Styles.isMobile ? buttons.reverse() : buttons}
      safeAreaViewBottomStyle={styles.safeAreaBottom}
    >
      <Kb.Box2 centerChildren={true} direction="vertical" style={styles.flexOne} fullWidth={true}>
        <Kb.Icon
          type={Styles.isMobile ? 'icon-wallet-remove-64' : 'icon-wallet-remove-48'}
          style={styles.icon}
        />
        <Kb.Text center={true} style={styles.warningText} type="Header">
          This removes{' '}
        </Kb.Text>
        <Kb.Text center={true} type="HeaderItalic" style={styles.warningText}>
          {name}
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
        <Kb.Text type="BodySmallExtrabold">{balance}</Kb.Text>
      </Kb.Box2>
    </WalletPopup>
  )
}

const styles = Styles.styleSheetCreate(() => ({
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
    isElectron: {wordBreak: 'break-word'} as const,
    isMobile: {
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    },
  }),
}))
