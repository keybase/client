import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import WalletPopup from './wallet-popup'
import {useState as useWalletsState} from '@/stores/wallets'

type OwnProps = {accountID: string}

const Container = (ownProps: OwnProps) => {
  const {accountID} = ownProps
  const account = useWalletsState(s => s.accountMap.get(accountID))
  const balance = account?.balanceDescription ?? 'Error loading account'
  const name = account?.name ?? ''
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onClose = () => {
    navigateUp()
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onDelete = () => {
    navigateAppend({props: {accountID}, selected: 'reallyRemoveAccount'}, true)
  }

  const buttons = [
    <Kb.Button fullWidth={Kb.Styles.isMobile} key={0} label="Cancel" onClick={onClose} type="Dim" />,
    <Kb.Button
      fullWidth={Kb.Styles.isMobile}
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
      bottomButtons={Kb.Styles.isMobile ? buttons.reverse() : buttons}
      safeAreaViewBottomStyle={styles.safeAreaBottom}
    >
      <Kb.Box2 centerChildren={true} direction="vertical" style={styles.flexOne} fullWidth={true}>
        <Kb.Icon
          type={Kb.Styles.isMobile ? 'icon-wallet-remove-64' : 'icon-wallet-remove-48'}
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
          style={Kb.Styles.collapseStyles([styles.warningText, styles.marginBottomTiny])}
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  flexOne: {flex: 1},
  header: {borderBottomWidth: 0},
  icon: Kb.Styles.platformStyles({
    common: {marginBottom: Kb.Styles.globalMargins.large},
    isElectron: {marginTop: Kb.Styles.globalMargins.medium},
    isMobile: {marginTop: Kb.Styles.globalMargins.xlarge},
  }),
  marginBottomTiny: {marginBottom: Kb.Styles.globalMargins.tiny},
  safeAreaBottom: {
    backgroundColor: Kb.Styles.globalColors.fastBlank,
  },
  warningText: Kb.Styles.platformStyles({
    isElectron: {wordBreak: 'break-word'} as const,
    isMobile: {
      paddingLeft: Kb.Styles.globalMargins.medium,
      paddingRight: Kb.Styles.globalMargins.medium,
    },
  }),
}))

export default Container


