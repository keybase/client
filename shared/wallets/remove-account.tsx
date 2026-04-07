import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import WalletPopup from './wallet-popup'
import {makeReallyRemoveAccountRouteParams} from './account-utils'

type OwnProps = {
  accountID: string
  balanceDescription: string
  name: string
}

const Container = (ownProps: OwnProps) => {
  const {accountID, balanceDescription, name} = ownProps
  const navigateUp = C.Router2.navigateUp
  const onClose = () => {
    navigateUp()
  }
  const navigateAppend = C.Router2.navigateAppend
  const onDelete = () => {
    navigateAppend(
      {name: 'reallyRemoveAccount', params: makeReallyRemoveAccountRouteParams({accountID, name})},
      true
    )
  }

  const buttons = [
    <Kb.Button fullWidth={Kb.Styles.isMobile} key={0} label="Cancel" onClick={onClose} type="Dim" />,
    <Kb.Button
      fullWidth={Kb.Styles.isMobile}
      key={1}
      label="Yes, remove"
      onClick={onDelete}
      type="Danger"
    />,
  ]

  return (
    <WalletPopup
      bottomButtons={Kb.Styles.isMobile ? buttons.reverse() : buttons}
    >
      <Kb.Box2 centerChildren={true} direction="vertical" flex={1} fullWidth={true}>
        <Kb.IconAuto
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
        <Kb.Text type="BodySmallExtrabold">{balanceDescription}</Kb.Text>
      </Kb.Box2>
    </WalletPopup>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  icon: Kb.Styles.platformStyles({
    common: {marginBottom: Kb.Styles.globalMargins.large},
    isElectron: {marginTop: Kb.Styles.globalMargins.medium},
    isMobile: {marginTop: Kb.Styles.globalMargins.xlarge},
  }),
  marginBottomTiny: {marginBottom: Kb.Styles.globalMargins.tiny},
  warningText: Kb.Styles.platformStyles({
    isElectron: {wordBreak: 'break-word'} as const,
    isMobile: {
      paddingLeft: Kb.Styles.globalMargins.medium,
      paddingRight: Kb.Styles.globalMargins.medium,
    },
  }),
}))

export default Container
